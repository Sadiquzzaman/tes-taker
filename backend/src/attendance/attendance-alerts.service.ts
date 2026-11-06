import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, In, IsNull, Repository } from 'typeorm';
import { GuardiansService } from 'src/academics/guardians.service';
import { SectionsService } from 'src/academics/sections.service';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService } from 'src/calendar/routine-slots.service';
import { addDays, isoDayOf, schoolDateIn } from 'src/common/utils/school-date.util';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, RecipientTypeEnum } from 'src/notifications/notification.constants';
import { NotificationsService, OutboxMessage } from 'src/notifications/notifications.service';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { AttendanceClock } from './attendance-clock';
import { countsFor } from './class-session-time';
import { ClassSessionsService } from './class-sessions.service';
import { AttendancePersonTypeEnum, AttendanceRecordEntity, AttendanceStatusEnum } from './entities/attendance-record.entity';
import { ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum } from './entities/section-attendance-settings.entity';
import { SessionClosingService } from './session-closing.service';

/** The day's absence SMS go out from this time in the organisation's time zone (ATT-10: 11:59 PM). */
export const END_OF_DAY_FROM = '23:59';
/** After a worker outage, a day's SMS and alerts still go out until this time the next morning; later they are dropped. */
export const END_OF_DAY_CATCH_UP_UNTIL = '08:00';
/** How far back a streak of absent days is looked for (the alert threshold is at most 30 school days). */
const STREAK_LOOKBACK_DAYS = 90;

/** A late check-in, for the guardian's Late SMS. */
export interface LateCheckIn {
  organizationId: string;
  studentId: string;
  date: string;
  checkedInAt: Date;
  sectionLabel: string;
}

export interface EndOfDayResult {
  organization_id: string;
  date: string;
  absent_students: number;
  absent_sms: number;
  repeat_alerts: number;
}

/** "HH:MM" of an instant in the time zone. */
const clockIn = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);

/**
 * Guardian SMS and the repeated-absence alert (ATT-06, ATT-10, ATT-14; design §6.1 "Alerts"). Every
 * message goes through the outbox (`NotificationsService`), so credits, "no credit" and the message
 * log are the dispatcher's job, and a dedupe key per student, day and guardian means a job that
 * runs twice never sends twice. Guardians are the student's live guardians (FND-09) in their SMS
 * language (FND-10). The organisation's `guardian_sms` switches (ATT-01) turn each SMS type on or off.
 * - **Late, at once:** on a student's late self check-in, once per student per day.
 * - **Absent, once a day:** from 23:59 in the organisation's time zone, one SMS when the student
 *   missed every class held that day (no SMS when any class was attended, or a paper register is
 *   not in yet). Closed days and cancelled classes have no Absent, so they never count.
 * - **Repeated absence:** an in-app alert to the section's class teacher (or its teachers) when a
 *   student has missed every class on N school days in a row (`repeat_absence_days`), once per streak.
 */
@Injectable()
export class AttendanceAlertsService {
  private readonly logger = new Logger(AttendanceAlertsService.name);

  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    private readonly closing: SessionClosingService,
    private readonly sessions: ClassSessionsService,
    private readonly sections: SectionsService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly guardians: GuardiansService,
    private readonly notifications: NotificationsService,
    private readonly orgSettings: OrgSettingsService,
    private readonly entitlements: EntitlementsService,
    private readonly clock: AttendanceClock,
  ) {}

  /** Queues the guardians' Late SMS in the check-in's transaction (when the organisation has it on). */
  async lateCheckIn(late: LateCheckIn, manager: EntityManager): Promise<void> {
    const settings = await this.orgSettings.getAttendance(late.organizationId, manager);
    if (!settings.guardian_sms.late) return;
    const contacts = await this.guardians.contactsForStudent(late.organizationId, late.studentId, manager);
    if (contacts.length === 0) return;
    const [student, organizationName] = await Promise.all([
      manager.getRepository(UserEntity).findOne({ where: { id: late.studentId }, select: ['id', 'full_name'] }),
      this.orgSettings.organizationName(late.organizationId),
    ]);
    await this.notifications.enqueue(
      contacts.map(
        (guardian): OutboxMessage => ({
          eventType: NOTIFICATION_EVENTS.ATTENDANCE_LATE,
          channel: NotificationChannelEnum.SMS,
          organizationId: late.organizationId,
          address: guardian.phone,
          recipientType: RecipientTypeEnum.GUARDIAN,
          recipientId: guardian.id,
          locale: guardian.locale,
          variables: {
            student_id: late.studentId,
            student_name: student?.full_name ?? '',
            class_name: late.sectionLabel,
            checked_in_at: late.checkedInAt.toISOString(),
            organization_name: organizationName,
          },
          // Once per student per day per type (design §6.1), even with two late classes.
          dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_LATE}:${late.studentId}:${late.date}:${guardian.id}`,
          createdBy: late.studentId,
        }),
      ),
      manager,
    );
  }

  /** The repeatable job: every organisation with schedules and the `attendance` feature whose day has ended. */
  async endOfDay(): Promise<EndOfDayResult[]> {
    const results: EndOfDayResult[] = [];
    for (const organizationId of await this.slots.organizationsWithActiveSlots()) {
      try {
        if (!(await this.entitlements.hasFeature(organizationId, FeatureKey.ATTENDANCE))) continue;
        const date = await this.dayToFinish(organizationId);
        if (date) results.push(await this.finishDay(organizationId, date));
      } catch (error) {
        this.logger.error(`End of day for organisation ${organizationId} failed: ${(error as Error).message}`);
      }
    }
    return results;
  }

  /** The school day whose end has come (from 23:59 to 08:00 the next morning, organisation time), or null. */
  async dayToFinish(organizationId: string): Promise<string | null> {
    const now = this.clock.now();
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, now);
    const time = clockIn(now, timeZone);
    if (time >= END_OF_DAY_FROM) return today;
    if (time < END_OF_DAY_CATCH_UP_UNTIL) return addDays(today, -1);
    return null;
  }

  /**
   * Ends a school day: closes its classes, then queues the absence SMS and the repeated-absence
   * alerts. Safe to run again: closing is idempotent and every message has a dedupe key.
   */
  async finishDay(organizationId: string, date: string): Promise<EndOfDayResult> {
    await this.closing.closeOrganization(organizationId, date);
    const result: EndOfDayResult = { organization_id: organizationId, date, absent_students: 0, absent_sms: 0, repeat_alerts: 0 };
    const absent = await this.absentAllDay(organizationId, date);
    result.absent_students = absent.size;
    if (absent.size === 0) return result;

    const [settings, names, organizationName] = await Promise.all([
      this.orgSettings.getAttendance(organizationId),
      this.namesOf([...absent.keys()]),
      this.orgSettings.organizationName(organizationId),
    ]);
    if (settings.guardian_sms.absent) {
      for (const [studentId, info] of absent) {
        const contacts = await this.guardians.contactsForStudent(organizationId, studentId);
        const ids = await this.notifications.enqueue(
          contacts.map(
            (guardian): OutboxMessage => ({
              eventType: NOTIFICATION_EVENTS.ATTENDANCE_ABSENT,
              channel: NotificationChannelEnum.SMS,
              organizationId,
              address: guardian.phone,
              recipientType: RecipientTypeEnum.GUARDIAN,
              recipientId: guardian.id,
              locale: guardian.locale,
              variables: { student_id: studentId, student_name: names.get(studentId) ?? '', class_name: info.sectionLabel, absent_on: date, organization_name: organizationName },
              dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_ABSENT}:${studentId}:${date}:${guardian.id}`,
            }),
          ),
        );
        result.absent_sms += ids.length;
      }
    }
    result.repeat_alerts = await this.repeatAbsenceAlerts(organizationId, date, absent, names, settings.repeat_absence_days);
    return result;
  }

  /**
   * Students who missed every class held on `date`, with the section of one of those classes:
   * at least one Absent record and no Present, Late or Leave, in classes that were not cancelled.
   * Students of a paper-register section with a class that day are left out until its register is in.
   */
  private async absentAllDay(organizationId: string, date: string): Promise<Map<string, { sectionId: string; sectionLabel: string }>> {
    const days = await this.dayMarks(organizationId, [date]);
    const absent = new Map<string, string>();
    for (const [key, mark] of days) {
      if (mark.allAbsent) absent.set(key.split('|')[0], mark.sectionId);
    }
    if (absent.size === 0) return new Map();

    const pending = await this.paperRegisterStudents(organizationId, date);
    const contexts = await this.sessions.contexts(organizationId, [...new Set(absent.values())]);
    const result = new Map<string, { sectionId: string; sectionLabel: string }>();
    for (const [studentId, sectionId] of absent) {
      if (pending.has(studentId)) continue;
      const section = contexts.get(sectionId)?.section;
      result.set(studentId, { sectionId, sectionLabel: section ? `${section.class?.class_name ?? ''} ${section.name}`.trim() : '' });
    }
    return result;
  }

  /**
   * Each student's mark for each date (key `student|date`): whether every recorded class that day
   * was an Absent, and the section of one of them. Cancelled classes are left out.
   */
  private async dayMarks(
    organizationId: string,
    dates: string[],
    studentIds?: string[],
  ): Promise<Map<string, { allAbsent: boolean; sectionId: string }>> {
    const from = dates.reduce((a, b) => (a < b ? a : b));
    const to = dates.reduce((a, b) => (a > b ? a : b));
    const records = await this.recordRepo.find({
      where: {
        organization_id: organizationId,
        person_type: AttendancePersonTypeEnum.STUDENT,
        date: from === to ? from : Between(from, to),
        ...(studentIds ? { person_id: In(studentIds) } : {}),
      },
      relations: ['session'],
    });
    const marks = new Map<string, { allAbsent: boolean; sectionId: string }>();
    for (const record of records) {
      if (!record.session || record.session.status === ClassSessionStatusEnum.CANCELLED) continue;
      const key = `${record.person_id}|${record.date}`;
      const isAbsent = record.status === AttendanceStatusEnum.ABSENT;
      const mark = marks.get(key);
      if (!mark) marks.set(key, { allAbsent: isAbsent, sectionId: record.session.section_id });
      else if (!isAbsent) mark.allAbsent = false;
    }
    return marks;
  }

  /** Students of paper-register sections that had a class on `date` (their register may not be in yet). */
  private async paperRegisterStudents(organizationId: string, date: string): Promise<Set<string>> {
    const [closed] = await this.holidays.closedDays(organizationId, date, date);
    if (closed) return new Set();
    const bySection = await this.slots.activeOfOrganization(organizationId);
    const contexts = await this.sessions.contexts(organizationId, [...bySection.keys()]);
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const paper = [...bySection].filter(
      ([sectionId, slots]) =>
        contexts.get(sectionId)?.mode === SectionAttendanceModeEnum.PAPER_REGISTER && slots.some((slot) => slot.day_of_week === isoDayOf(date)),
    );
    if (paper.length === 0) return new Set();
    const rosters = await this.sections.activeStudentsOfSections(organizationId, paper.map(([id]) => id));
    const result = new Set<string>();
    for (const [sectionId, slots] of paper) {
      const context = contexts.get(sectionId);
      if (!context) continue;
      const windows = slots.filter((slot) => slot.day_of_week === isoDayOf(date)).map((slot) => this.sessions.window(context, slot, date, timeZone));
      for (const row of rosters.get(sectionId) ?? []) {
        if (windows.some((window) => countsFor(window, null, row.since))) result.add(row.student_id);
      }
    }
    return result;
  }

  /**
   * Repeated-absence alerts (ATT-14) for students absent all of `date`: the school days in a row
   * (days with a class for them, newest first) on which they missed every class. At `threshold`
   * or more, the section's class teacher (or its teachers, else the organisation's owners) gets
   * one in-app alert per streak (keyed by the streak's first day).
   */
  private async repeatAbsenceAlerts(
    organizationId: string,
    date: string,
    absent: Map<string, { sectionId: string; sectionLabel: string }>,
    names: Map<string, string>,
    threshold: number,
  ): Promise<number> {
    const studentIds = [...absent.keys()];
    const from = addDays(date, -STREAK_LOOKBACK_DAYS);
    const marks = await this.dayMarks(organizationId, [from, date], studentIds);
    const byStudent = new Map<string, { date: string; allAbsent: boolean }[]>();
    for (const [key, mark] of marks) {
      const [studentId, day] = key.split('|');
      if (day > date) continue;
      byStudent.set(studentId, [...(byStudent.get(studentId) ?? []), { date: day, allAbsent: mark.allAbsent }]);
    }

    const streaks: { studentId: string; days: number; since: string }[] = [];
    for (const studentId of studentIds) {
      const days = (byStudent.get(studentId) ?? []).sort((a, b) => b.date.localeCompare(a.date));
      let count = 0;
      let since = date;
      for (const day of days) {
        if (!day.allAbsent) break;
        count++;
        since = day.date;
      }
      if (count >= threshold) streaks.push({ studentId, days: count, since });
    }
    if (streaks.length === 0) return 0;

    const sectionIds = [...new Set(streaks.map((streak) => (absent.get(streak.studentId) as { sectionId: string }).sectionId))];
    const teachers = await this.sections.followUpTeachers(organizationId, sectionIds);
    const slotTeachers = await this.slots.activeBySection(organizationId, sectionIds);
    let owners: string[] | null = null;
    let sent = 0;
    for (const streak of streaks) {
      const info = absent.get(streak.studentId) as { sectionId: string; sectionLabel: string };
      let recipients = teachers.get(info.sectionId) ?? [];
      if (recipients.length === 0) {
        recipients = [...new Set((slotTeachers.get(info.sectionId) ?? []).map((slot) => slot.teacher_id).filter((id): id is string => Boolean(id)))];
      }
      if (recipients.length === 0) recipients = owners ??= await this.ownersOf(organizationId);
      const ids = await this.notifications.notifyUsers({
        eventType: NOTIFICATION_EVENTS.ATTENDANCE_REPEAT_ABSENCE,
        organizationId,
        userIds: recipients,
        variables: {
          student_id: streak.studentId,
          student_name: names.get(streak.studentId) ?? '',
          class_name: info.sectionLabel,
          days: streak.days,
          since_on: streak.since,
          path: '/attendance',
        },
        dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_REPEAT_ABSENCE}:${streak.studentId}:${streak.since}`,
      });
      if (ids.length > 0) sent++;
    }
    return sent;
  }

  private async ownersOf(organizationId: string): Promise<string[]> {
    const rows = await this.memberRepo.find({
      where: { organization_id: organizationId, role: OrganizationMemberRoleEnum.OWNER, removed_at: IsNull() },
      select: ['user_id'],
    });
    return rows.map((row) => row.user_id);
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.recordRepo.manager.getRepository(UserEntity).find({ where: { id: In(ids) }, select: ['id', 'full_name'] });
    return new Map(rows.map((row) => [row.id, row.full_name]));
  }
}
