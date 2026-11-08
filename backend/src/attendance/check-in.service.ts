import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { SectionsService } from 'src/academics/sections.service';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService, SlotView } from 'src/calendar/routine-slots.service';
import { ClosedDay } from 'src/calendar/closed-days';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { isoDayOf, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { AttendanceAlertsService } from './attendance-alerts.service';
import { ApprovedLeaveService } from './approved-leave.service';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import {
  CheckInState,
  checkInState,
  clockIn,
  countsFor,
  distanceMetres,
  isEdgeAccuracy,
  isImpossibleJump,
  JUMP_WINDOW_HOURS,
  lateness,
  MAX_ACCURACY_M,
  SessionWindow,
} from './class-session-time';
import { ClassSessionsService, coveredByOther, recordView, RecordView, SectionContext, sessionKey } from './class-sessions.service';
import { CheckInDto } from './dto/check-in.dto';
import {
  AttendanceFlagEnum,
  AttendancePersonTypeEnum,
  AttendanceRecordEntity,
  AttendanceRecordSourceEnum,
  AttendanceStatusEnum,
} from './entities/attendance-record.entity';
import { ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum, SectionClassTypeEnum } from './entities/section-attendance-settings.entity';

/** Why a class takes no self check-in today, or null when it does. */
export type CheckInBlock = 'CLOSED_DAY' | 'CANCELLED' | 'PAPER_REGISTER' | 'NO_PIN' | 'SESSION_CLOSED' | null;

/** One of the caller's classes on a day, with the check-in window and their own record. */
export interface MyClassView {
  slot_id: string;
  date: string;
  /** Whether the caller attends it as a student or teaches it (ATT-11). */
  role: AttendancePersonTypeEnum;
  section: { id: string; name: string; class_name: string };
  /** The subject of the period (from the routine), or null for a whole-section class. */
  subject: { id: string; name: string } | null;
  class_type: SectionClassTypeEnum;
  mode: SectionAttendanceModeEnum;
  start_time: string;
  end_time: string;
  opens_at: Date;
  starts_at: Date;
  late_after: Date;
  ends_at: Date;
  state: CheckInState;
  /** In-person check-in needs the browser's location. */
  needs_location: boolean;
  blocked: CheckInBlock;
  can_check_in: boolean;
  record: RecordView | null;
}

/** `GET /attendance/me/today`: the school date and time from the server, and the caller's classes today. */
export interface TodayView {
  date: string;
  server_time: Date;
  time_zone: string;
  /** Today is a weekly off day or a holiday: no class takes check-ins. */
  closed: ClosedDay | null;
  /** The caller is on approved leave today (P3-06): their classes count as Leave unless they check in. */
  on_leave: boolean;
  classes: MyClassView[];
}

/** A slot the caller attends or teaches. */
export interface MySlot {
  role: AttendancePersonTypeEnum;
  section_id: string;
  slot: SlotView;
  /** Students: when the enrolment started. */
  since?: Date;
}

const STAFF_ROLES = [
  OrganizationMemberRoleEnum.OWNER,
  OrganizationMemberRoleEnum.ADMIN,
  OrganizationMemberRoleEnum.ASSISTANT,
  OrganizationMemberRoleEnum.TEACHER,
];

/**
 * Web self check-in (ATT-04, ATT-06, ATT-11): students check in to their section's class, teachers
 * to the classes they teach, while the window is open (15 minutes before the start to the end).
 * In-person classes need the browser's position within the branch's radius at an accuracy of
 * 100 m or better; online classes take check-ins from anywhere. The time is the server's, in the
 * organisation's time zone. One check-in per person per session; odd ones are saved with a flag.
 */
@Injectable()
export class CheckInService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    private readonly sessions: ClassSessionsService,
    private readonly sections: SectionsService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly clock: AttendanceClock,
    private readonly alerts: AttendanceAlertsService,
    private readonly leave: ApprovedLeaveService,
    private readonly dataSource: DataSource,
  ) {}

  async today(tenant: Tenant, userId: string): Promise<TodayView> {
    const organizationId = tenant.organizationId;
    const now = this.clock.now();
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const date = schoolDateIn(timeZone, now);
    const [closed = null] = await this.holidays.closedDays(organizationId, date, date);
    const mine = [
      ...(await this.mySlots(tenant, userId)).filter((item) => item.slot.day_of_week === isoDayOf(date)),
      ...(await this.substituteSlots(tenant, userId, date)),
    ].filter((item, index, all) => all.findIndex((other) => other.slot.id === item.slot.id) === index);
    const contexts = await this.sessions.contexts(organizationId, mine.map((item) => item.section_id));
    const saved = await this.sessions.savedSessions(organizationId, mine.map((item) => item.slot.id), date, date);
    // A teacher's class that another teacher takes as a substitute that day is not theirs (P5-04).
    const usable = mine.filter(
      (item) => contexts.get(item.section_id)?.open && !(item.role === AttendancePersonTypeEnum.TEACHER && coveredByOther(saved.get(sessionKey(item.slot.id, date)), userId)),
    );
    const records = await this.sessions.records(organizationId, [...saved.values()].map((s) => s.id), userId);
    const added = await this.slots.createdAt(organizationId, usable.map((item) => item.slot.id));

    // Only classes that count for this person (their period existed, and they had joined, before the
    // class started), unless they checked in — as on "My attendance" and for the closing job.
    const counted = usable.filter((item) => {
      const session = saved.get(sessionKey(item.slot.id, date));
      if (session && records.get(session.id)?.length) return true;
      const window = this.sessions.window(contexts.get(item.section_id) as SectionContext, item.slot, date, timeZone, session);
      return countsFor(window, added.get(item.slot.id), item.since);
    });

    const classes = counted.map((item) => {
      const context = contexts.get(item.section_id) as SectionContext;
      const session = saved.get(sessionKey(item.slot.id, date));
      const record = session ? (records.get(session.id)?.[0] ?? null) : null;
      return this.classView(item, context, date, timeZone, now, closed, session, record);
    });
    classes.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime() || a.section.class_name.localeCompare(b.section.class_name));
    const onLeave = Boolean((await this.leave.between(organizationId, date, date, [userId])).on(userId, date));
    return { date, server_time: now, time_zone: timeZone, closed, on_leave: onLeave, classes };
  }

  async checkIn(tenant: Tenant, userId: string, dto: CheckInDto): Promise<MyClassView> {
    const organizationId = tenant.organizationId;
    const slot = await this.slots.findActive(organizationId, dto.slot_id);
    if (!slot) throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.CHECKIN_CLASS_NOT_FOUND });
    const now = this.clock.now();
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const date = schoolDateIn(timeZone, now);
    const mine =
      (await this.mySlots(tenant, userId)).find((item) => item.slot.id === slot.id) ??
      (await this.substituteSlots(tenant, userId, date)).find((item) => item.slot.id === slot.id);
    const context = (await this.sessions.contexts(organizationId, [slot.section_id])).get(slot.section_id);
    const today = (await this.sessions.savedSessions(organizationId, [slot.id], date, date)).get(sessionKey(slot.id, date));
    if (!mine || !context?.open || (mine.role === AttendancePersonTypeEnum.TEACHER && coveredByOther(today, userId))) {
      throw new ForbiddenException({ message: 'You can check in only to your own classes', code: ATTENDANCE_ERRORS.CHECKIN_NOT_YOUR_CLASS });
    }

    if (slot.day_of_week !== isoDayOf(date)) {
      throw new ConflictException({ message: 'This class does not meet today', code: ATTENDANCE_ERRORS.CHECKIN_NO_CLASS_TODAY });
    }
    const [closed] = await this.holidays.closedDays(organizationId, date, date);
    if (closed) {
      throw new ConflictException({ message: 'There are no classes today', code: ATTENDANCE_ERRORS.CHECKIN_CLOSED_DAY, details: closed });
    }
    if (context.mode === SectionAttendanceModeEnum.PAPER_REGISTER) {
      throw new ConflictException({ message: 'This class keeps attendance on paper', code: ATTENDANCE_ERRORS.CHECKIN_PAPER_REGISTER });
    }
    const saved = (await this.sessions.savedSessions(organizationId, [slot.id], date, date)).get(sessionKey(slot.id, date));
    if (saved?.status === ClassSessionStatusEnum.CANCELLED) {
      throw new ConflictException({ message: 'This class is cancelled today', code: ATTENDANCE_ERRORS.CHECKIN_CANCELLED });
    }
    const window = this.sessions.window(context, slot, date, timeZone, saved);
    const state = checkInState(now, window);
    if (state === 'UPCOMING') {
      throw new ConflictException({ message: 'Check-in has not opened yet', code: ATTENDANCE_ERRORS.CHECKIN_NOT_OPEN, details: { opens_at: window.opens_at } });
    }
    if (state === 'CLOSED') {
      throw new ConflictException({ message: 'Check-in for this class has closed', code: ATTENDANCE_ERRORS.CHECKIN_CLOSED, details: { ends_at: window.ends_at } });
    }
    if (saved) await this.assertNotCheckedIn(organizationId, saved.id, userId);

    const place = context.class_type === SectionClassTypeEnum.IN_PERSON ? await this.placeOf(context, dto, userId, organizationId, now) : null;
    const late = lateness(now, window);

    const { session, record, created } = await this.dataSource.transaction(async (manager) => {
      const session = saved ?? (await this.sessions.ensureSession(manager, organizationId, slot.section_id, slot.id, date, window));
      const records = manager.getRepository(AttendanceRecordEntity);
      // A second check-in racing this one finds the unique (session, person) row and inserts nothing.
      const inserted = await records
        .createQueryBuilder()
        .insert()
        .into(AttendanceRecordEntity)
        .values({
          organization_id: organizationId,
          class_attendance_id: session.id,
          date,
          person_id: userId,
          person_type: mine.role,
          status: late.late ? AttendanceStatusEnum.LATE : AttendanceStatusEnum.PRESENT,
          checked_in_at: now,
          late_minutes: late.minutes,
          source: AttendanceRecordSourceEnum.SELF,
          geo_lat: place ? place.latitude.toFixed(6) : null,
          geo_lng: place ? place.longitude.toFixed(6) : null,
          distance_m: place?.distance ?? null,
          accuracy_m: place?.accuracy ?? null,
          flag: place?.flag ?? null,
        })
        .orIgnore()
        .returning('id')
        .execute();
      const record = await records.findOneOrFail({ where: { organization_id: organizationId, class_attendance_id: session.id, person_id: userId } });
      const created = (inserted.raw as unknown[]).length > 0;
      // The guardians' Late SMS goes into the outbox with the check-in (ATT-06: at once).
      if (created && late.late && mine.role === AttendancePersonTypeEnum.STUDENT) {
        await this.alerts.lateCheckIn(
          {
            organizationId,
            studentId: userId,
            date,
            checkedInAt: now,
            sectionLabel: `${context.section.class?.class_name ?? ''} ${context.section.name}`.trim(),
          },
          manager,
        );
      }
      return { session, record, created };
    });
    if (!created) await this.assertNotCheckedIn(organizationId, session.id, userId);
    return this.classView(mine, context, date, timeZone, now, null, session, record);
  }

  /**
   * The slots the caller attends or teaches, in open sessions. Students: their section's slots.
   * Teachers (any staff role, in organisations but not in a solo teacher's own workspace): slots
   * that name them, and slots without a teacher in sections they teach.
   */
  async mySlots(tenant: Tenant, userId: string): Promise<MySlot[]> {
    const organizationId = tenant.organizationId;
    if (tenant.viaEnrolment || tenant.memberRole === OrganizationMemberRoleEnum.STUDENT) {
      const enrolments = await this.sections.activeSectionsOfStudent(organizationId, userId);
      const slots = await this.slots.activeBySection(organizationId, enrolments.map((e) => e.section_id));
      return enrolments.flatMap((enrolment) =>
        (slots.get(enrolment.section_id) ?? []).map((slot) => ({
          role: AttendancePersonTypeEnum.STUDENT,
          section_id: enrolment.section_id,
          slot,
          since: enrolment.since,
        })),
      );
    }
    if (tenant.kind === OrganizationKindEnum.SOLO || !STAFF_ROLES.includes(tenant.memberRole)) return [];
    const [taught, named] = await Promise.all([
      this.sections.sectionIdsTaughtInOpenSessions(organizationId, userId),
      this.slots.activeOfTeacher(organizationId, userId),
    ]);
    const unnamed = await this.slots.activeBySection(organizationId, [...taught]);
    const result: MySlot[] = [];
    const seen = new Set<string>();
    const add = (sectionId: string, slot: SlotView) => {
      if (seen.has(slot.id)) return;
      seen.add(slot.id);
      result.push({ role: AttendancePersonTypeEnum.TEACHER, section_id: sectionId, slot });
    };
    for (const [sectionId, slots] of named) slots.forEach((slot) => add(sectionId, slot));
    for (const [sectionId, slots] of unnamed) slots.filter((slot) => !slot.teacher_id).forEach((slot) => add(sectionId, slot));
    return result;
  }

  /** Classes the teacher takes as a substitute on `date` (P5-04), as their own slots that day. */
  private async substituteSlots(tenant: Tenant, userId: string, date: string): Promise<MySlot[]> {
    if (tenant.viaEnrolment || tenant.kind === OrganizationKindEnum.SOLO || !STAFF_ROLES.includes(tenant.memberRole)) return [];
    const result: MySlot[] = [];
    for (const session of await this.sessions.substitutedFor(tenant.organizationId, userId, date, date)) {
      const slot = await this.slots.findActive(tenant.organizationId, session.routine_slot_id);
      if (slot) result.push({ role: AttendancePersonTypeEnum.TEACHER, section_id: slot.section_id, slot });
    }
    return result;
  }

  classView(
    item: MySlot,
    context: SectionContext,
    date: string,
    timeZone: string,
    now: Date,
    closed: ClosedDay | null,
    saved: { starts_at: Date; ends_at: Date; status?: ClassSessionStatusEnum } | undefined,
    record: AttendanceRecordEntity | null,
  ): MyClassView {
    const window: SessionWindow = this.sessions.window(context, item.slot, date, timeZone, saved);
    const state = checkInState(now, window);
    const inPerson = context.class_type === SectionClassTypeEnum.IN_PERSON;
    const blocked: CheckInBlock = closed
      ? 'CLOSED_DAY'
      : saved?.status === ClassSessionStatusEnum.CANCELLED
        ? 'CANCELLED'
        : context.mode === SectionAttendanceModeEnum.PAPER_REGISTER
        ? 'PAPER_REGISTER'
        : inPerson && (context.branch.geo_lat === null || context.branch.geo_lng === null)
          ? 'NO_PIN'
          : null;
    return {
      slot_id: item.slot.id,
      date,
      role: item.role,
      section: { id: context.section.id, name: context.section.name, class_name: context.section.class?.class_name ?? '' },
      subject: item.slot.subject,
      class_type: context.class_type,
      mode: context.mode,
      start_time: clockIn(window.starts_at, timeZone),
      end_time: clockIn(window.ends_at, timeZone),
      ...window,
      state,
      needs_location: inPerson,
      blocked,
      can_check_in: !blocked && state === 'OPEN' && !record,
      record: record ? recordView(record) : null,
    };
  }

  private async assertNotCheckedIn(organizationId: string, sessionId: string | undefined, userId: string): Promise<void> {
    if (!sessionId) return;
    const existing = await this.recordRepo.findOne({ where: { organization_id: organizationId, class_attendance_id: sessionId, person_id: userId } });
    if (existing) {
      throw new ConflictException({
        message: 'You have already checked in to this class',
        code: ATTENDANCE_ERRORS.CHECKIN_ALREADY,
        details: { record: recordView(existing) },
      });
    }
  }

  /**
   * Checks an in-person check-in's position against the branch pin and radius and returns what is
   * saved with it; throws when it cannot be accepted (no pin, no position, poor accuracy, too far).
   */
  private async placeOf(context: SectionContext, dto: CheckInDto, userId: string, organizationId: string, now: Date) {
    const branch = context.branch;
    if (branch.geo_lat === null || branch.geo_lng === null) {
      throw new ConflictException({ message: 'The check-in location of this class is not set yet; ask your admin', code: ATTENDANCE_ERRORS.CHECKIN_NO_PIN });
    }
    if (dto.latitude === undefined || dto.longitude === undefined || dto.accuracy_m === undefined) {
      throw new BadRequestException({ message: 'Allow location to check in to this class', code: ATTENDANCE_ERRORS.CHECKIN_LOCATION_REQUIRED });
    }
    const accuracy = Math.ceil(dto.accuracy_m);
    if (accuracy > MAX_ACCURACY_M) {
      throw new BadRequestException({
        message: `Your location is not accurate enough (${accuracy} m); move near a window and try again`,
        code: ATTENDANCE_ERRORS.CHECKIN_ACCURACY_POOR,
        details: { accuracy_m: accuracy, max_accuracy_m: MAX_ACCURACY_M },
      });
    }
    const distance = Math.round(distanceMetres(Number(branch.geo_lat), Number(branch.geo_lng), dto.latitude, dto.longitude));
    if (distance > branch.checkin_radius_m) {
      throw new BadRequestException({
        message: `You are ${distance} m away from your class`,
        code: ATTENDANCE_ERRORS.CHECKIN_TOO_FAR,
        details: { distance_m: distance, radius_m: branch.checkin_radius_m },
      });
    }
    let flag: AttendanceFlagEnum | null = isEdgeAccuracy(distance, accuracy, branch.checkin_radius_m) ? AttendanceFlagEnum.EDGE_ACCURACY : null;
    const previous = await this.recordRepo.findOne({
      where: {
        organization_id: organizationId,
        person_id: userId,
        geo_lat: Not(IsNull()),
        checked_in_at: MoreThan(new Date(now.getTime() - JUMP_WINDOW_HOURS * 3_600_000)),
      },
      order: { checked_in_at: 'DESC' },
    });
    if (previous?.checked_in_at && previous.checked_in_at < now && previous.geo_lng !== null) {
      const moved = distanceMetres(Number(previous.geo_lat), Number(previous.geo_lng), dto.latitude, dto.longitude);
      if (isImpossibleJump(moved, now.getTime() - previous.checked_in_at.getTime())) flag = AttendanceFlagEnum.IMPOSSIBLE_JUMP;
    }
    return { latitude: dto.latitude, longitude: dto.longitude, distance, accuracy, flag };
  }
}
