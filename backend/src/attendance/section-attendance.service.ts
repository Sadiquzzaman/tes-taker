import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { addDays } from 'src/common/utils/school-date.util';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ClosedDay } from 'src/calendar/closed-days';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService, SlotView } from 'src/calendar/routine-slots.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { isoDayOf, isSchoolDate, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { ApprovedLeaveService, LeaveCalendar } from './approved-leave.service';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { CheckInState, checkInState, countsFor, CHECKIN_OPENS_BEFORE_MINUTES, SessionWindow, zonedInstant } from './class-session-time';
import { ClassSessionsService, recordView, RecordView, SectionContext, sessionKey, teacherOf } from './class-sessions.service';
import { CancelClassDto, ChangeClassDto, CorrectRecordDto } from './dto/correction.dto';
import { AttendanceCorrectionEntity } from './entities/attendance-correction.entity';
import {
  AttendancePersonTypeEnum,
  AttendanceRecordEntity,
  AttendanceRecordSourceEnum,
  AttendanceStatusEnum,
} from './entities/attendance-record.entity';
import { ClassSessionEntity, ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum, SectionClassTypeEnum } from './entities/section-attendance-settings.entity';
import { CalendarStatus, clockIn, statusOf } from './my-attendance.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NOTIFICATION_EVENTS } from 'src/notifications/notification.constants';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
/** See and correct every class; only they correct teachers' own records. */
const MANAGERS = [OWNER, ADMIN, ASSISTANT];
/**
 * Teachers correct their classes of the last 7 days (owners, admins and assistants have no limit
 * while the academic session is open): enough for a phone without internet or a forgotten
 * check-in, short enough that last month's register and its SMS stay as they were.
 */
export const TEACHER_CORRECTION_DAYS = 7;
/** A class can be cancelled from today up to this many days ahead (ATT-19). */
export const CANCEL_AHEAD_DAYS = 60;

/** Who cancelled a class, when and why (ATT-19). */
export interface CancellationView {
  at: Date | null;
  by: { id: string; full_name: string } | null;
  note: string | null;
}
/** A one-day change of a class (P5-04): its own times and/or a substitute, who changed it and why. */
export interface ClassChangeView {
  /** The routine's times; the summary's start_time/end_time are the times that day. */
  routine_start_time: string;
  routine_end_time: string;
  substitute: { id: string; full_name: string } | null;
  at: Date | null;
  by: { id: string; full_name: string } | null;
  note: string | null;
}
export interface CorrectionView {
  id: string;
  old_status: AttendanceStatusEnum | null;
  new_status: AttendanceStatusEnum;
  reason: string;
  corrected_by: { id: string; full_name: string } | null;
  created_at: Date;
}

/** One person on a class's list: a student of the section, or a teacher who checks in to it. */
export interface RosterRow {
  person: { id: string; full_name: string; roll_no: string | null };
  role: AttendancePersonTypeEnum;
  status: CalendarStatus;
  record: RecordView | null;
  corrections: CorrectionView[];
  can_correct: boolean;
}

export interface SessionSummary {
  slot_id: string;
  date: string;
  section: { id: string; name: string; class_name: string };
  start_time: string;
  end_time: string;
  class_type: SectionClassTypeEnum;
  mode: SectionAttendanceModeEnum;
  starts_at: Date;
  late_after: Date;
  ends_at: Date;
  state: CheckInState;
  closed: ClosedDay | null;
  /** Who teaches it that day: the substitute (P5-04), else the routine's teacher. */
  teacher: { id: string; full_name: string } | null;
  /** Set when the time or teacher was changed for that day (P5-04). */
  change: ClassChangeView | null;
  /** Students only. `waiting`: upcoming, open or a paper register not in yet. */
  counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; flagged: number };
  /** Set when the class was cancelled for that day (ATT-19); nobody is Absent then. */
  cancelled: CancellationView | null;
  /** Corrections are possible once the class has started, on a school day, in an open session, unless cancelled (teachers: the last 7 days). */
  can_correct: boolean;
  /** The class can be cancelled (today or later, before it ends, on a school day) or restored. */
  can_cancel: boolean;
  can_restore: boolean;
  /** The time or teacher can be changed for that day: before check-in opens, nobody checked in, not cancelled (P5-04). */
  can_change: boolean;
}

export interface SessionDetail extends SessionSummary {
  students: RosterRow[];
  teachers: RosterRow[];
}

/** `GET /attendance/sessions`: the classes the caller may see on a date. */
export interface SessionsOnDate {
  date: string;
  today: string;
  time_zone: string;
  closed: ClosedDay | null;
  sessions: SessionSummary[];
}

export interface SlotRef {
  section_id: string;
  slot: SlotView;
}

/** Everything about one class on one date, loaded once. */
interface Loaded {
  ref: SlotRef;
  context: SectionContext;
  date: string;
  timeZone: string;
  window: SessionWindow;
  state: CheckInState;
  closed: ClosedDay | null;
  session: ClassSessionEntity | undefined;
  records: AttendanceRecordEntity[];
  roster: { student_id: string; full_name: string; roll_no: string | null; since: Date }[];
  /** Approved leave on the date (P3-06): people without a record show as Leave. */
  leave: LeaveCalendar;
  cancelled: boolean;
  can_correct: boolean;
  can_cancel: boolean;
  can_restore: boolean;
  can_change: boolean;
}

/**
 * The teacher's section view and corrections (ATT-07, ATT-12, ATT-11): every class of a date with
 * who checked in, and a correction of any person's status with a reason, kept in
 * `attendance_corrections` and the audit log. Owners, admins and assistants see and correct every
 * class; a teacher the classes of the sections they teach and the slots that name them, and never
 * a teacher's record. A student without a record shows as Absent once check-in has closed (the
 * closing job saves it then). No roll call: teachers only correct, and cancel a class for a day
 * (ATT-19), which keeps the session row with who cancelled it and tells the students in-app.
 */
@Injectable()
export class SectionAttendanceService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    @InjectRepository(AttendanceCorrectionEntity)
    private readonly correctionRepo: Repository<AttendanceCorrectionEntity>,
    private readonly sessions: ClassSessionsService,
    private readonly sections: SectionsService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly leave: ApprovedLeaveService,
    private readonly clock: AttendanceClock,
    private readonly access: OrganizationAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async list(tenant: Tenant, userId: string, date?: string): Promise<SessionsOnDate> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const day = this.validDate(date ?? today);
    const refs = (await this.visibleSlots(tenant, userId, day)).filter((ref) => ref.slot.day_of_week === isoDayOf(day));
    const loaded = await this.load(tenant, refs, day, timeZone, today);
    const sessions = loaded.map((item) => this.summary(item));
    sessions.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime() || `${a.section.class_name} ${a.section.name}`.localeCompare(`${b.section.class_name} ${b.section.name}`));
    const [closed = null] = await this.holidays.closedDays(organizationId, day, day);
    return { date: day, today, time_zone: timeZone, closed, sessions };
  }

  async detail(tenant: Tenant, userId: string, slotId: string, date: string): Promise<SessionDetail> {
    const timeZone = await this.orgSettings.timeZone(tenant.organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const ref = await this.visibleSlot(tenant, userId, slotId, this.validDate(date));
    const [item] = await this.load(tenant, [ref], date, timeZone, today);
    if (!item) throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    return this.detailOf(tenant, item);
  }

  async correct(tenant: Tenant, userId: string, slotId: string, date: string, personId: string, dto: CorrectRecordDto): Promise<SessionDetail> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const ref = await this.visibleSlot(tenant, userId, slotId, this.validDate(date));
    const [item] = await this.load(tenant, [ref], date, timeZone, today);
    if (!item) throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    if (item.closed) {
      throw new ConflictException({ message: 'There was no class that day', code: ATTENDANCE_ERRORS.CORRECTION_CLOSED_DAY });
    }
    if (item.cancelled) {
      throw new ConflictException({ message: 'This class was cancelled', code: ATTENDANCE_ERRORS.CORRECTION_CANCELLED });
    }
    if (!isManager(tenant) && date < addDays(today, -TEACHER_CORRECTION_DAYS)) {
      throw new ConflictException({
        message: `Teachers correct classes of the last ${TEACHER_CORRECTION_DAYS} days`,
        code: ATTENDANCE_ERRORS.CORRECTION_TOO_OLD,
        details: { days: TEACHER_CORRECTION_DAYS },
      });
    }
    if (!item.can_correct) {
      throw new ConflictException({ message: 'This class has not started yet', code: ATTENDANCE_ERRORS.CORRECTION_NOT_STARTED });
    }

    const student = item.roster.find((row) => row.student_id === personId && schoolDateIn(timeZone, row.since) <= date);
    const teacherRecord = item.records.find((record) => record.person_id === personId && record.person_type === AttendancePersonTypeEnum.TEACHER);
    let role: AttendancePersonTypeEnum;
    if (student) {
      role = AttendancePersonTypeEnum.STUDENT;
    } else if (teacherRecord || teacherOf(ref.slot, item.session) === personId) {
      if (!isManager(tenant)) {
        throw new ForbiddenException({ message: "Teachers correct students' attendance only", code: ATTENDANCE_ERRORS.CORRECTION_TEACHER_RECORD });
      }
      role = AttendancePersonTypeEnum.TEACHER;
    } else {
      throw new NotFoundException({ message: 'This person is not in this class', code: ATTENDANCE_ERRORS.CORRECTION_PERSON_NOT_FOUND });
    }

    const now = new Date();
    const result = await this.dataSource.transaction(async (manager) => {
      const session = item.session ?? (await this.sessions.ensureSession(manager, organizationId, ref.section_id, ref.slot.id, date, item.window));
      const records = manager.getRepository(AttendanceRecordEntity);
      const where = { organization_id: organizationId, class_attendance_id: session.id, person_id: personId };
      let existing = await records.findOne({ where, lock: { mode: 'pessimistic_write' } });
      const lateMinutes = dto.status === AttendanceStatusEnum.LATE ? (dto.late_minutes ?? existing?.late_minutes ?? null) : null;
      if (!existing) {
        const inserted = await records
          .createQueryBuilder()
          .insert()
          .into(AttendanceRecordEntity)
          .values({ ...where, date, person_type: role, status: dto.status, late_minutes: lateMinutes, source: AttendanceRecordSourceEnum.CORRECTION, updated_by: userId, updated_at: now })
          .orIgnore()
          .returning('id')
          .execute();
        const created = await records.findOneOrFail({ where, lock: { mode: 'pessimistic_write' } });
        if ((inserted.raw as unknown[]).length > 0) return this.saveCorrection(manager, organizationId, created, null, null, dto, userId);
        existing = created; // a check-in landed in between: correct that record instead
      }
      if (existing.status === dto.status && existing.late_minutes === lateMinutes) {
        throw new BadRequestException({ message: 'The record already has this status', code: ATTENDANCE_ERRORS.CORRECTION_NO_CHANGE });
      }
      const before = { status: existing.status, late_minutes: existing.late_minutes };
      await records.update({ id: existing.id }, { status: dto.status, late_minutes: lateMinutes, source: AttendanceRecordSourceEnum.CORRECTION, updated_by: userId, updated_at: now });
      return this.saveCorrection(manager, organizationId, { ...existing, status: dto.status, late_minutes: lateMinutes }, before.status, before.late_minutes, dto, userId);
    });

    this.audit.record({
      action: AUDIT_ACTIONS.ATTENDANCE_CORRECT,
      organizationId,
      actorId: userId,
      entityType: 'attendance_record',
      entityId: result.record.id,
      before: { status: result.old_status, late_minutes: result.old_late_minutes },
      after: { status: result.record.status, late_minutes: result.record.late_minutes, person_id: personId, date, slot_id: ref.slot.id, section_id: ref.section_id },
      reason: dto.reason,
    });
    return this.detail(tenant, userId, slotId, date);
  }

  /**
   * Cancels a class for one day (ATT-19): today or up to 60 days ahead, before it ends, on a school
   * day. The session row is kept (status CANCELLED, who, when and the note) and nobody is marked
   * Absent; the section's students are told in-app. Check-ins already made stay on the record.
   */
  async cancel(tenant: Tenant, userId: string, slotId: string, date: string, dto: CancelClassDto): Promise<SessionDetail> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const now = this.clock.now();
    const today = schoolDateIn(timeZone, now);
    const ref = await this.visibleSlot(tenant, userId, slotId, this.validDate(date));
    const [item] = await this.load(tenant, [ref], date, timeZone, today);
    if (!item) throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    if (item.closed) throw new ConflictException({ message: 'There is no class that day', code: ATTENDANCE_ERRORS.CANCEL_CLOSED_DAY });
    if (item.cancelled) throw new ConflictException({ message: 'This class is already cancelled', code: ATTENDANCE_ERRORS.CANCEL_ALREADY });
    if (date < today) throw new ConflictException({ message: 'A past class cannot be cancelled', code: ATTENDANCE_ERRORS.CANCEL_PAST });
    if (date > addDays(today, CANCEL_AHEAD_DAYS)) {
      throw new ConflictException({ message: `Classes can be cancelled up to ${CANCEL_AHEAD_DAYS} days ahead`, code: ATTENDANCE_ERRORS.CANCEL_TOO_FAR, details: { days: CANCEL_AHEAD_DAYS } });
    }
    if (now >= item.window.ends_at) throw new ConflictException({ message: 'This class has already ended', code: ATTENDANCE_ERRORS.CANCEL_ENDED });

    const note = dto.note?.trim() || null;
    const session = await this.dataSource.transaction(async (manager) => {
      const session = await this.lockedSession(manager, organizationId, item);
      if (session.status === ClassSessionStatusEnum.CANCELLED) {
        throw new ConflictException({ message: 'This class is already cancelled', code: ATTENDANCE_ERRORS.CANCEL_ALREADY });
      }
      if (session.status === ClassSessionStatusEnum.CLOSED) {
        throw new ConflictException({ message: 'This class has already ended', code: ATTENDANCE_ERRORS.CANCEL_ENDED });
      }
      const changes = { status: ClassSessionStatusEnum.CANCELLED, cancelled_at: new Date(), cancelled_by: userId, cancel_note: note };
      await manager.getRepository(ClassSessionEntity).update({ id: session.id }, changes);
      await this.tellStudents(manager, item, session.id, userId, NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CANCELLED, note, changes.cancelled_at);
      return session;
    });

    this.audit.record({
      action: AUDIT_ACTIONS.ATTENDANCE_CANCEL,
      organizationId,
      actorId: userId,
      entityType: 'class_session',
      entityId: session.id,
      before: { status: ClassSessionStatusEnum.SCHEDULED },
      after: { status: ClassSessionStatusEnum.CANCELLED, note, date, slot_id: ref.slot.id, section_id: ref.section_id },
    });
    return this.detail(tenant, userId, slotId, date);
  }

  /** Restores a cancelled class (before it ends): it takes check-ins again and is closed as usual; students are told in-app. */
  async restore(tenant: Tenant, userId: string, slotId: string, date: string): Promise<SessionDetail> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const ref = await this.visibleSlot(tenant, userId, slotId, this.validDate(date));
    const [item] = await this.load(tenant, [ref], date, timeZone, today);
    if (!item) throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    if (!item.cancelled) throw new ConflictException({ message: 'This class is not cancelled', code: ATTENDANCE_ERRORS.CANCEL_NOT_CANCELLED });
    if (!item.can_restore) throw new ConflictException({ message: 'This class has already ended', code: ATTENDANCE_ERRORS.CANCEL_ENDED });

    const before = { status: ClassSessionStatusEnum.CANCELLED, note: item.session?.cancel_note ?? null, cancelled_by: item.session?.cancelled_by ?? null };
    const session = await this.dataSource.transaction(async (manager) => {
      const session = await this.lockedSession(manager, organizationId, item);
      if (session.status !== ClassSessionStatusEnum.CANCELLED) {
        throw new ConflictException({ message: 'This class is not cancelled', code: ATTENDANCE_ERRORS.CANCEL_NOT_CANCELLED });
      }
      await manager
        .getRepository(ClassSessionEntity)
        .update({ id: session.id }, { status: ClassSessionStatusEnum.SCHEDULED, cancelled_at: null, cancelled_by: null, cancel_note: null });
      await this.tellStudents(manager, item, session.id, userId, NOTIFICATION_EVENTS.ATTENDANCE_CLASS_RESTORED, null, new Date());
      return session;
    });

    this.audit.record({
      action: AUDIT_ACTIONS.ATTENDANCE_RESTORE,
      organizationId,
      actorId: userId,
      entityType: 'class_session',
      entityId: session.id,
      before,
      after: { status: ClassSessionStatusEnum.SCHEDULED, date, slot_id: ref.slot.id, section_id: ref.section_id },
    });
    return this.detail(tenant, userId, slotId, date);
  }

  /**
   * Changes one class for one day (P5-04, CAL-01): other times that day (same date, no overlap with
   * the section's other classes, still in the future) and/or a substitute teacher (a teaching
   * member), with a note. Possible from today up to 60 days ahead, before check-in opens, while
   * nobody has checked in. The rest of the routine is untouched. Sending the routine's own times and
   * no substitute undoes the change. Students, the routine's teacher and the substitute are told in-app.
   */
  async change(tenant: Tenant, userId: string, slotId: string, date: string, dto: ChangeClassDto): Promise<SessionDetail> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const now = this.clock.now();
    const today = schoolDateIn(timeZone, now);
    const ref = await this.visibleSlot(tenant, userId, slotId, this.validDate(date));
    const [item] = await this.load(tenant, [ref], date, timeZone, today);
    if (!item) throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    if (item.closed) throw new ConflictException({ message: 'There is no class that day', code: ATTENDANCE_ERRORS.CANCEL_CLOSED_DAY });
    if (item.cancelled) throw new ConflictException({ message: 'This class is cancelled that day', code: ATTENDANCE_ERRORS.CANCEL_ALREADY });
    if (date < today) throw new ConflictException({ message: 'A past class cannot be changed', code: ATTENDANCE_ERRORS.CANCEL_PAST });
    if (date > addDays(today, CANCEL_AHEAD_DAYS)) {
      throw new ConflictException({ message: `Classes can be changed up to ${CANCEL_AHEAD_DAYS} days ahead`, code: ATTENDANCE_ERRORS.CANCEL_TOO_FAR, details: { days: CANCEL_AHEAD_DAYS } });
    }
    if (!item.can_change) {
      throw new ConflictException({ message: 'Change a class before its check-in opens, while nobody has checked in', code: ATTENDANCE_ERRORS.CHANGE_STARTED });
    }

    // The times that day: the new ones (both or neither), else the current ones.
    if ((dto.start_time === undefined) !== (dto.end_time === undefined)) {
      throw new BadRequestException({ message: 'Give both a start and an end time', code: ATTENDANCE_ERRORS.CHANGE_TIME_INVALID });
    }
    const start = dto.start_time ? hhmmOf(dto.start_time) : clockIn(item.window.starts_at, timeZone);
    const end = dto.end_time ? hhmmOf(dto.end_time) : clockIn(item.window.ends_at, timeZone);
    if (end <= start) throw new BadRequestException({ message: 'The end must be after the start', code: ATTENDANCE_ERRORS.CHANGE_TIME_INVALID });
    const startsAt = zonedInstant(date, start, timeZone);
    const endsAt = zonedInstant(date, end, timeZone);
    if (startsAt.getTime() - CHECKIN_OPENS_BEFORE_MINUTES * 60_000 <= now.getTime()) {
      throw new BadRequestException({ message: 'Choose a time that has not started yet', code: ATTENDANCE_ERRORS.CHANGE_TIME_INVALID });
    }
    await this.assertNoSectionOverlap(organizationId, ref, date, timeZone, startsAt, endsAt);

    // The teacher that day: a substitute (not the routine's own teacher), else the routine's.
    let substituteId = dto.substitute_teacher_id !== undefined ? dto.substitute_teacher_id : (item.session?.substitute_teacher_id ?? null);
    if (substituteId === ref.slot.teacher_id) substituteId = null;
    if (substituteId) {
      const membership = await this.access.getMembership(organizationId, substituteId);
      if (!this.access.isAssignableTeachingRole(membership?.role)) {
        throw new BadRequestException({ message: 'The substitute must be a teaching member of this organisation', code: ATTENDANCE_ERRORS.CHANGE_TEACHER_INVALID });
      }
    }

    const isRoutine = start === ref.slot.start_time && end === ref.slot.end_time && !substituteId;
    const before = {
      start_time: clockIn(item.window.starts_at, timeZone),
      end_time: clockIn(item.window.ends_at, timeZone),
      substitute_teacher_id: item.session?.substitute_teacher_id ?? null,
      note: item.session?.change_note ?? null,
    };
    const note = dto.note?.trim() || null;
    if (before.start_time === start && before.end_time === end && before.substitute_teacher_id === substituteId && (isRoutine || before.note === note)) {
      throw new BadRequestException({ message: 'The class already has these times and this teacher', code: ATTENDANCE_ERRORS.CHANGE_NONE });
    }

    const at = new Date();
    const session = await this.dataSource.transaction(async (manager) => {
      const session = await this.lockedSession(manager, organizationId, item);
      const records = await manager.getRepository(AttendanceRecordEntity).count({ where: { organization_id: organizationId, class_attendance_id: session.id } });
      if (session.status !== ClassSessionStatusEnum.SCHEDULED || records > 0) {
        throw new ConflictException({ message: 'Change a class before its check-in opens, while nobody has checked in', code: ATTENDANCE_ERRORS.CHANGE_STARTED });
      }
      await manager.getRepository(ClassSessionEntity).update(
        { id: session.id },
        isRoutine
          ? { starts_at: startsAt, ends_at: endsAt, substitute_teacher_id: null, changed_at: null, changed_by: null, change_note: null }
          : { starts_at: startsAt, ends_at: endsAt, substitute_teacher_id: substituteId, changed_at: at, changed_by: userId, change_note: note },
      );
      const teacherIds = [ref.slot.teacher_id, before.substitute_teacher_id, substituteId].filter((id): id is string => Boolean(id));
      const names = await this.namesOf([...new Set(teacherIds)]);
      const section = item.context.section;
      await this.notifications.notifyUsers(
        {
          eventType: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CHANGED,
          organizationId,
          userIds: [...new Set([...item.roster.map((row) => row.student_id), ...teacherIds])].filter((id) => id !== userId),
          variables: {
            class_name: `${section.class?.class_name ?? ''} ${section.name}`.trim(),
            class_on: date,
            start_time: start,
            end_time: end,
            teacher_name: (substituteId ? names.get(substituteId) : ref.slot.teacher_id ? names.get(ref.slot.teacher_id) : null) ?? 'NO_TEACHER',
            note: note ?? '',
            path: '/my-attendance',
          },
          dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CHANGED}:${session.id}:${at.getTime()}`,
          createdBy: userId,
        },
        manager,
      );
      return session;
    });

    this.audit.record({
      action: AUDIT_ACTIONS.ATTENDANCE_CHANGE,
      organizationId,
      actorId: userId,
      entityType: 'class_session',
      entityId: session.id,
      before,
      after: { start_time: start, end_time: end, substitute_teacher_id: substituteId, note: isRoutine ? null : note, undone: isRoutine, date, slot_id: ref.slot.id, section_id: ref.section_id },
    });
    return this.detail(tenant, userId, slotId, date);
  }

  /** The new times must not overlap the section's other classes that day (their own times that day). */
  private async assertNoSectionOverlap(organizationId: string, ref: SlotRef, date: string, timeZone: string, startsAt: Date, endsAt: Date): Promise<void> {
    const others = ((await this.slots.activeBySection(organizationId, [ref.section_id])).get(ref.section_id) ?? []).filter(
      (slot) => slot.id !== ref.slot.id && slot.day_of_week === isoDayOf(date),
    );
    if (others.length === 0) return;
    const [context] = [...(await this.sessions.contexts(organizationId, [ref.section_id])).values()];
    const saved = await this.sessions.savedSessions(organizationId, others.map((slot) => slot.id), date, date);
    for (const slot of others) {
      const session = saved.get(sessionKey(slot.id, date));
      if (session?.status === ClassSessionStatusEnum.CANCELLED) continue;
      const window = this.sessions.window(context, slot, date, timeZone, session);
      if (startsAt < window.ends_at && window.starts_at < endsAt) {
        throw new ConflictException({
          message: 'The section has another class at that time',
          code: ATTENDANCE_ERRORS.CHANGE_OVERLAP,
          details: { slot_id: slot.id, start_time: clockIn(window.starts_at, timeZone), end_time: clockIn(window.ends_at, timeZone) },
        });
      }
    }
  }

  /** The class's session row under a row lock, made first when it does not exist yet (a future class). */
  private async lockedSession(manager: EntityManager, organizationId: string, item: Loaded): Promise<ClassSessionEntity> {
    const created = item.session ?? (await this.sessions.ensureSession(manager, organizationId, item.ref.section_id, item.ref.slot.id, item.date, item.window));
    return manager.getRepository(ClassSessionEntity).findOneOrFail({ where: { id: created.id }, lock: { mode: 'pessimistic_write' } });
  }

  /** An in-app notice to the class's students (never the person who made the change), in the same transaction. */
  private async tellStudents(
    manager: EntityManager,
    item: Loaded,
    sessionId: string,
    userId: string,
    eventType: typeof NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CANCELLED | typeof NOTIFICATION_EVENTS.ATTENDANCE_CLASS_RESTORED,
    note: string | null,
    at: Date,
  ): Promise<void> {
    const section = item.context.section;
    await this.notifications.notifyUsers(
      {
        eventType,
        organizationId: item.context.section.organization_id,
        userIds: item.roster.map((row) => row.student_id).filter((id) => id !== userId),
        variables: {
          class_name: `${section.class?.class_name ?? ''} ${section.name}`.trim(),
          class_on: item.date,
          start_time: item.ref.slot.start_time,
          note: note ?? '',
          path: '/my-attendance',
        },
        // One notice per change: cancelling, restoring and cancelling again each tell the students.
        dedupeKey: `${eventType}:${sessionId}:${at.getTime()}`,
        createdBy: userId,
      },
      manager,
    );
  }

  private async saveCorrection(
    manager: EntityManager,
    organizationId: string,
    record: AttendanceRecordEntity,
    oldStatus: AttendanceStatusEnum | null,
    oldLate: number | null,
    dto: CorrectRecordDto,
    userId: string,
  ) {
    await manager.getRepository(AttendanceCorrectionEntity).insert({
      organization_id: organizationId,
      record_id: record.id,
      old_status: oldStatus,
      new_status: dto.status,
      reason: dto.reason,
      corrected_by: userId,
    });
    return { record, old_status: oldStatus, old_late_minutes: oldLate };
  }

  /**
   * Slots the caller may see, in open sessions: every slot for owners, admins and assistants; for a
   * teacher the slots of sections they teach and the slots that name them, and on `date` the
   * classes they take as a substitute (P5-04).
   */
  async visibleSlots(tenant: Tenant, userId: string, date?: string): Promise<SlotRef[]> {
    const organizationId = tenant.organizationId;
    if (tenant.viaEnrolment || ![...MANAGERS, TEACHER].includes(tenant.memberRole)) {
      throw new ForbiddenException('Only staff can see class attendance');
    }
    const bySection = isManager(tenant)
      ? await this.slots.activeOfOrganization(organizationId)
      : await (async () => {
          const [taught, named] = await Promise.all([
            this.sections.sectionIdsTaughtInOpenSessions(organizationId, userId),
            this.slots.activeOfTeacher(organizationId, userId),
          ]);
          const result = await this.slots.activeBySection(organizationId, [...taught]);
          for (const [sectionId, slots] of named) {
            const have = result.get(sectionId) ?? [];
            result.set(sectionId, [...have, ...slots.filter((slot) => !have.some((h) => h.id === slot.id))]);
          }
          if (date) {
            for (const session of await this.sessions.substitutedFor(organizationId, userId, date, date)) {
              const slot = await this.slots.findActive(organizationId, session.routine_slot_id);
              const have = result.get(session.section_id) ?? [];
              if (slot && !have.some((h) => h.id === slot.id)) result.set(session.section_id, [...have, slot]);
            }
          }
          return result;
        })();
    return [...bySection].flatMap(([section_id, slots]) => slots.map((slot) => ({ section_id, slot })));
  }

  /**
   * Every class of these sections on `date` with each student's status, worked out as on the class
   * view (the daily summary, ATT-13). No access check; the caller passes the sections it may show.
   */
  async dayClasses(
    tenant: Tenant,
    sectionIds: string[],
    date: string,
  ): Promise<{ summary: SessionSummary; students: { id: string; full_name: string; roll_no: string | null; status: CalendarStatus }[] }[]> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const day = this.validDate(date);
    const bySection = await this.slots.activeBySection(organizationId, sectionIds);
    const refs = [...bySection].flatMap(([section_id, slots]) => slots.filter((slot) => slot.day_of_week === isoDayOf(day)).map((slot) => ({ section_id, slot })));
    const loaded = await this.load(tenant, refs, day, timeZone, today);
    return loaded
      .sort((a, b) => a.window.starts_at.getTime() - b.window.starts_at.getTime())
      .map((item) => {
        const byPerson = new Map(item.records.map((record) => [record.person_id, record]));
        return {
          summary: this.summary(item),
          students: item.roster.map((row) => ({
            id: row.student_id,
            full_name: row.full_name,
            roll_no: row.roll_no,
            status: this.statusOf(item, row.student_id, byPerson.get(row.student_id)),
          })),
        };
      });
  }

  private async visibleSlot(tenant: Tenant, userId: string, slotId: string, date: string): Promise<SlotRef> {
    const ref = (await this.visibleSlots(tenant, userId, date)).find((item) => item.slot.id === slotId);
    if (!ref || ref.slot.day_of_week !== isoDayOf(date)) {
      throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    }
    return ref;
  }

  private async load(tenant: Tenant, refs: SlotRef[], date: string, timeZone: string, today: string): Promise<Loaded[]> {
    const organizationId = tenant.organizationId;
    const contexts = await this.sessions.contexts(organizationId, refs.map((ref) => ref.section_id));
    const open = refs.filter((ref) => contexts.get(ref.section_id)?.open);
    if (open.length === 0) return [];
    const [added, closedDays, saved, rosters] = await Promise.all([
      this.slots.createdAt(organizationId, open.map((ref) => ref.slot.id)),
      this.holidays.closedDays(organizationId, date, date),
      this.sessions.savedSessions(organizationId, open.map((ref) => ref.slot.id), date, date),
      this.sections.activeStudentsOfSections(organizationId, [...new Set(open.map((ref) => ref.section_id))]),
    ]);
    const records = await this.sessions.records(organizationId, [...saved.values()].map((session) => session.id));
    const leave = await this.leave.between(organizationId, date, date);
    const now = this.clock.now();
    const closed = closedDays[0] ?? null;
    const result: Loaded[] = [];
    for (const ref of open) {
      const context = contexts.get(ref.section_id) as SectionContext;
      const session = saved.get(sessionKey(ref.slot.id, date));
      const window = this.sessions.window(context, ref.slot, date, timeZone, session);
      // A class exists only once its slot was added before it started (as on "My attendance" and for the closing job).
      const slotCounts = countsFor(window, added.get(ref.slot.id));
      if (!slotCounts && !session) continue;
      const sessionRecords = session ? (records.get(session.id) ?? []) : [];
      const recorded = new Set(sessionRecords.map((record) => record.person_id));
      const state = checkInState(now, window);
      const cancelled = session?.status === ClassSessionStatusEnum.CANCELLED;
      result.push({
        ref,
        context,
        date,
        timeZone,
        window,
        state,
        closed,
        session,
        records: sessionRecords,
        // Students who joined after the class started are not on its list, unless they checked in.
        roster: (rosters.get(ref.section_id) ?? []).filter((row) => recorded.has(row.student_id) || (slotCounts && countsFor(window, null, row.since))),
        leave,
        cancelled,
        can_correct: !closed && !cancelled && date <= today && now >= window.starts_at && (isManager(tenant) || date >= addDays(today, -TEACHER_CORRECTION_DAYS)),
        can_cancel: !closed && !cancelled && date >= today && date <= addDays(today, CANCEL_AHEAD_DAYS) && now < window.ends_at,
        can_restore: cancelled && !closed && now < window.ends_at,
        can_change:
          !closed && !cancelled && session?.status !== ClassSessionStatusEnum.CLOSED && sessionRecords.length === 0 && date >= today && date <= addDays(today, CANCEL_AHEAD_DAYS) && now < window.opens_at,
      });
    }
    return result;
  }

  private statusOf(item: Loaded, personId: string, record: AttendanceRecordEntity | undefined): CalendarStatus {
    return statusOf(record, item.closed, item.context, item.state, item.session, Boolean(item.leave.on(personId, item.date)));
  }

  private summary(item: Loaded): SessionSummary {
    const counts = { students: item.roster.length, present: 0, late: 0, absent: 0, leave: 0, waiting: 0, flagged: 0 };
    const byPerson = new Map(item.records.map((record) => [record.person_id, record]));
    for (const student of item.roster) {
      const record = byPerson.get(student.student_id);
      const status = this.statusOf(item, student.student_id, record);
      if (status === 'PRESENT') counts.present++;
      else if (status === 'LATE') counts.late++;
      else if (status === 'ABSENT') counts.absent++;
      else if (status === 'LEAVE') counts.leave++;
      else if (status !== 'CLOSED_DAY' && status !== 'CANCELLED') counts.waiting++;
      if (record?.flag) counts.flagged++;
    }
    return {
      slot_id: item.ref.slot.id,
      date: item.date,
      section: { id: item.context.section.id, name: item.context.section.name, class_name: item.context.section.class?.class_name ?? '' },
      start_time: clockIn(item.window.starts_at, item.timeZone),
      end_time: clockIn(item.window.ends_at, item.timeZone),
      class_type: item.context.class_type,
      mode: item.context.mode,
      starts_at: item.window.starts_at,
      late_after: item.window.late_after,
      ends_at: item.window.ends_at,
      state: item.state,
      closed: item.closed,
      teacher: item.session?.substitute
        ? { id: item.session.substitute.id, full_name: item.session.substitute.full_name }
        : item.ref.slot.teacher,
      change: item.session?.changed_at
        ? {
            routine_start_time: item.ref.slot.start_time,
            routine_end_time: item.ref.slot.end_time,
            substitute: item.session.substitute ? { id: item.session.substitute.id, full_name: item.session.substitute.full_name } : null,
            at: item.session.changed_at,
            by: item.session.changer ? { id: item.session.changer.id, full_name: item.session.changer.full_name } : null,
            note: item.session.change_note,
          }
        : null,
      counts,
      cancelled: item.cancelled && item.session
        ? {
            at: item.session.cancelled_at,
            by: item.session.canceller ? { id: item.session.canceller.id, full_name: item.session.canceller.full_name } : null,
            note: item.session.cancel_note,
          }
        : null,
      can_correct: item.can_correct,
      can_cancel: item.can_cancel,
      can_restore: item.can_restore,
      can_change: item.can_change,
    };
  }

  private async detailOf(tenant: Tenant, item: Loaded): Promise<SessionDetail> {
    const manager = isManager(tenant);
    const byPerson = new Map(item.records.map((record) => [record.person_id, record]));
    const corrections = await this.correctionsOf(tenant.organizationId, item.records.map((record) => record.id));
    const row = (person: RosterRow['person'], role: AttendancePersonTypeEnum, canCorrect: boolean): RosterRow => {
      const record = byPerson.get(person.id);
      return {
        person,
        role,
        status: this.statusOf(item, person.id, record),
        record: record ? recordView(record) : null,
        corrections: record ? (corrections.get(record.id) ?? []) : [],
        can_correct: canCorrect,
      };
    };
    const students = item.roster.map((student) =>
      row({ id: student.student_id, full_name: student.full_name, roll_no: student.roll_no }, AttendancePersonTypeEnum.STUDENT, item.can_correct),
    );
    // Teachers: who teaches it that day (the substitute, else the slot's teacher), and anyone who checked in as a teacher.
    const teacherIds = new Set(item.records.filter((record) => record.person_type === AttendancePersonTypeEnum.TEACHER).map((record) => record.person_id));
    const teaching = teacherOf(item.ref.slot, item.session);
    if (teaching) teacherIds.add(teaching);
    const names = await this.namesOf([...teacherIds]);
    const teachers = [...teacherIds].map((id) =>
      row({ id, full_name: names.get(id) ?? '', roll_no: null }, AttendancePersonTypeEnum.TEACHER, item.can_correct && manager),
    );
    return { ...this.summary(item), students, teachers };
  }

  private async correctionsOf(organizationId: string, recordIds: string[]): Promise<Map<string, CorrectionView[]>> {
    const result = new Map<string, CorrectionView[]>();
    if (recordIds.length === 0) return result;
    const rows = await this.correctionRepo.find({
      where: { organization_id: organizationId, record_id: In(recordIds) },
      relations: ['corrector'],
      order: { created_at: 'ASC' },
    });
    for (const row of rows) {
      result.set(row.record_id, [
        ...(result.get(row.record_id) ?? []),
        {
          id: row.id,
          old_status: row.old_status,
          new_status: row.new_status,
          reason: row.reason,
          corrected_by: row.corrector ? { id: row.corrector.id, full_name: row.corrector.full_name } : null,
          created_at: row.created_at,
        },
      ]);
    }
    return result;
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.recordRepo.manager.getRepository(UserEntity).find({ where: { id: In(ids) }, select: ['id', 'full_name'] });
    return new Map(rows.map((row) => [row.id, row.full_name]));
  }

  private validDate(date: string): string {
    if (!isSchoolDate(date)) throw new BadRequestException({ message: 'Choose a real date', code: ATTENDANCE_ERRORS.SESSION_DATE_INVALID });
    return date;
  }
}

/** "9:05" or "09:05:00" → "09:05" (the DTO has checked the shape). */
const hhmmOf = (value: string) => {
  const [h, m] = value.split(':');
  return `${h.padStart(2, '0')}:${m}`;
};

/** Owners, admins and assistants: every class, no correction limit. */
export const isManager = (tenant: Tenant) => !tenant.viaEnrolment && MANAGERS.includes(tenant.memberRole);
