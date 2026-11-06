import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService, SlotView } from 'src/calendar/routine-slots.service';
import { addDays, daysBetween, isoDayOf, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { AttendanceClock } from './attendance-clock';
import { countsFor, SessionWindow } from './class-session-time';
import { ClassSessionsService, SectionContext, sessionKey } from './class-sessions.service';
import {
  AttendancePersonTypeEnum,
  AttendanceRecordEntity,
  AttendanceRecordSourceEnum,
  AttendanceStatusEnum,
} from './entities/attendance-record.entity';
import { ClassSessionEntity, ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum } from './entities/section-attendance-settings.entity';

/** How many school days back the closing job looks, so classes missed while the worker was down are closed. */
export const CLOSE_CATCH_UP_DAYS = 7;

export interface ClosingResult {
  sessions_closed: number;
  students_absent: number;
  teachers_absent: number;
}

/** One class whose check-in has closed and that is still open. */
interface Ended {
  section_id: string;
  slot: SlotView;
  date: string;
  window: SessionWindow;
  saved: ClassSessionEntity | undefined;
  /** The slot existed when the class started (else nobody is marked Absent). */
  counts: boolean;
}

/**
 * Closes class sessions once check-in has closed (ATT-10, design §7 `attendance.close-sessions`):
 * every ACTIVE student of the section without a record is saved as Absent (source AUTO_ABSENT),
 * and so is the slot's named teacher in an organisation (ATT-11); the session becomes CLOSED.
 * Skipped: weekly off days and holidays, cancelled classes (ATT-19), paper-register sections (their
 * register is imported, P3-05), closed academic sessions, slots added after the class started and
 * students who joined after it started. Safe to run twice and at the same time as itself: each
 * session is closed in one transaction under a row lock, and records are insert-or-ignore on
 * (session, person). Looks back `CLOSE_CATCH_UP_DAYS`, so a worker that was down catches up.
 * Runs in the worker for every organisation with the `attendance` feature.
 */
@Injectable()
export class SessionClosingService {
  private readonly logger = new Logger(SessionClosingService.name);

  constructor(
    private readonly sessions: ClassSessionsService,
    private readonly sections: SectionsService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly clock: AttendanceClock,
    private readonly dataSource: DataSource,
  ) {}

  /** The repeatable job: every organisation with schedules and the `attendance` feature. */
  async closeEnded(): Promise<ClosingResult & { organizations: number }> {
    const total = { organizations: 0, sessions_closed: 0, students_absent: 0, teachers_absent: 0 };
    for (const organizationId of await this.slots.organizationsWithActiveSlots()) {
      try {
        if (!(await this.entitlements.hasFeature(organizationId, FeatureKey.ATTENDANCE))) continue;
        const result = await this.closeOrganization(organizationId);
        total.organizations++;
        total.sessions_closed += result.sessions_closed;
        total.students_absent += result.students_absent;
        total.teachers_absent += result.teachers_absent;
      } catch (error) {
        // One organisation's problem must not stop the others; the next run tries again.
        this.logger.error(`Closing classes of organisation ${organizationId} failed: ${(error as Error).message}`);
      }
    }
    return total;
  }

  /**
   * Closes the organisation's ended classes from `CLOSE_CATCH_UP_DAYS` ago to today (or only on
   * `onlyDate`), and records the counts in the audit log when anything was closed.
   */
  async closeOrganization(organizationId: string, onlyDate?: string): Promise<ClosingResult> {
    const now = this.clock.now();
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, now);
    const from = onlyDate ?? addDays(today, -CLOSE_CATCH_UP_DAYS);
    const to = onlyDate ?? today;
    const result: ClosingResult = { sessions_closed: 0, students_absent: 0, teachers_absent: 0 };

    const ended = await this.endedClasses(organizationId, from, to, timeZone, now);
    if (ended.length === 0) return result;
    const [rosters, kind] = await Promise.all([
      this.sections.activeStudentsOfSections(organizationId, [...new Set(ended.map((item) => item.section_id))]),
      this.orgSettings.kind(organizationId),
    ]);

    for (const item of ended) {
      const students = item.counts
        ? (rosters.get(item.section_id) ?? []).filter((row) => countsFor(item.window, null, row.since)).map((row) => row.student_id)
        : [];
      // A solo teacher's own workspace has no teacher check-in (P3-03).
      const teacherId = item.counts && kind !== OrganizationKindEnum.SOLO ? item.slot.teacher_id : null;
      const closed = await this.closeSession(organizationId, item, students, teacherId);
      if (!closed) continue;
      result.sessions_closed++;
      result.students_absent += closed.students;
      result.teachers_absent += closed.teachers;
    }

    if (result.sessions_closed > 0) {
      this.audit.record({
        action: AUDIT_ACTIONS.ATTENDANCE_AUTO_ABSENT,
        organizationId,
        actorId: null,
        entityType: 'organization',
        entityId: organizationId,
        after: { ...result, from, to },
      });
    }
    return result;
  }

  /** Classes from `from` to `to` whose check-in has closed and that are not closed or cancelled yet. */
  private async endedClasses(organizationId: string, from: string, to: string, timeZone: string, now: Date): Promise<Ended[]> {
    const bySection = await this.slots.activeOfOrganization(organizationId);
    const refs = [...bySection].flatMap(([section_id, slots]) => slots.map((slot) => ({ section_id, slot })));
    if (refs.length === 0) return [];
    const slotIds = refs.map((ref) => ref.slot.id);
    const [contexts, closedDays, added, saved] = await Promise.all([
      this.sessions.contexts(organizationId, [...bySection.keys()]),
      this.holidays.closedDays(organizationId, from, to),
      this.slots.createdAt(organizationId, slotIds),
      this.sessions.savedSessions(organizationId, slotIds, from, to),
    ]);
    const closed = new Set(closedDays.map((day) => day.date));

    const result: Ended[] = [];
    for (let i = 0; i < daysBetween(from, to); i++) {
      const date = addDays(from, i);
      if (closed.has(date)) continue;
      for (const ref of refs) {
        if (ref.slot.day_of_week !== isoDayOf(date)) continue;
        const context = contexts.get(ref.section_id) as SectionContext | undefined;
        if (!context?.open || context.mode !== SectionAttendanceModeEnum.SELF_CHECKIN) continue;
        const session = saved.get(sessionKey(ref.slot.id, date));
        if (session && session.status !== ClassSessionStatusEnum.SCHEDULED) continue;
        const window = this.sessions.window(context, ref.slot, date, timeZone, session);
        if (now < window.ends_at) continue;
        const counts = countsFor(window, added.get(ref.slot.id));
        // A class added after it started, with nobody checked in, never existed: nothing to close.
        if (!counts && !session) continue;
        result.push({ section_id: ref.section_id, slot: ref.slot, date, window, saved: session, counts });
      }
    }
    return result;
  }

  /** Saves the missing Absent records and closes the session; null when another run or a cancellation got there first. */
  private async closeSession(
    organizationId: string,
    item: Ended,
    studentIds: string[],
    teacherId: string | null,
  ): Promise<{ students: number; teachers: number } | null> {
    return this.dataSource.transaction(async (manager) => {
      const created = item.saved ?? (await this.sessions.ensureSession(manager, organizationId, item.section_id, item.slot.id, item.date, item.window));
      const session = await manager.getRepository(ClassSessionEntity).findOne({ where: { id: created.id }, lock: { mode: 'pessimistic_write' } });
      if (!session || session.status !== ClassSessionStatusEnum.SCHEDULED) return null;

      const absent = (personId: string, personType: AttendancePersonTypeEnum) => ({
        organization_id: organizationId,
        class_attendance_id: session.id,
        date: item.date,
        person_id: personId,
        person_type: personType,
        status: AttendanceStatusEnum.ABSENT,
        source: AttendanceRecordSourceEnum.AUTO_ABSENT,
      });
      const rows = [
        ...studentIds.map((id) => absent(id, AttendancePersonTypeEnum.STUDENT)),
        ...(teacherId && !studentIds.includes(teacherId) ? [absent(teacherId, AttendancePersonTypeEnum.TEACHER)] : []),
      ];
      let students = 0;
      let teachers = 0;
      if (rows.length > 0) {
        // Anyone who checked in (or was corrected) keeps their record: (session, person) is unique.
        const inserted = await manager
          .createQueryBuilder()
          .insert()
          .into(AttendanceRecordEntity)
          .values(rows)
          .orIgnore()
          .returning(['person_type'])
          .execute();
        for (const row of inserted.raw as { person_type: AttendancePersonTypeEnum }[]) {
          if (row.person_type === AttendancePersonTypeEnum.TEACHER) teachers++;
          else students++;
        }
      }
      await manager.getRepository(ClassSessionEntity).update({ id: session.id }, { status: ClassSessionStatusEnum.CLOSED, closed_at: new Date() });
      return { students, teachers };
    });
  }
}
