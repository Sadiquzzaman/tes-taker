import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ClosedDay } from 'src/calendar/closed-days';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService, SlotView } from 'src/calendar/routine-slots.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { isoDayOf, isSchoolDate, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { CheckInState, checkInState, SessionWindow } from './class-session-time';
import { ClassSessionsService, recordView, RecordView, SectionContext, sessionKey } from './class-sessions.service';
import { CorrectRecordDto } from './dto/correction.dto';
import { AttendanceCorrectionEntity } from './entities/attendance-correction.entity';
import {
  AttendancePersonTypeEnum,
  AttendanceRecordEntity,
  AttendanceRecordSourceEnum,
  AttendanceStatusEnum,
} from './entities/attendance-record.entity';
import { ClassSessionEntity } from './entities/class-session.entity';
import { SectionAttendanceModeEnum, SectionClassTypeEnum } from './entities/section-attendance-settings.entity';
import { CalendarStatus } from './my-attendance.service';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
/** See and correct every class; only they correct teachers' own records. */
const MANAGERS = [OWNER, ADMIN, ASSISTANT];

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
  teacher: { id: string; full_name: string } | null;
  /** Students only. `waiting`: upcoming, open or a paper register not in yet. */
  counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; flagged: number };
  /** Corrections are possible once the class has started, on a school day, in an open session. */
  can_correct: boolean;
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

interface SlotRef {
  section_id: string;
  slot: SlotView;
}

/** Everything about one class on one date, loaded once. */
interface Loaded {
  ref: SlotRef;
  context: SectionContext;
  date: string;
  window: SessionWindow;
  state: CheckInState;
  closed: ClosedDay | null;
  session: ClassSessionEntity | undefined;
  records: AttendanceRecordEntity[];
  roster: { student_id: string; full_name: string; roll_no: string | null; since: Date }[];
  can_correct: boolean;
}

/**
 * The teacher's section view and corrections (ATT-07, ATT-12, ATT-11): every class of a date with
 * who checked in, and a correction of any person's status with a reason, kept in
 * `attendance_corrections` and the audit log. Owners, admins and assistants see and correct every
 * class; a teacher the classes of the sections they teach and the slots that name them, and never
 * a teacher's record. A student without a record shows as Absent once check-in has closed (P3-04
 * saves it then). No roll call: teachers only correct.
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
    private readonly clock: AttendanceClock,
    private readonly dataSource: DataSource,
  ) {}

  async list(tenant: Tenant, userId: string, date?: string): Promise<SessionsOnDate> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const day = this.validDate(date ?? today);
    const refs = (await this.visibleSlots(tenant, userId)).filter((ref) => ref.slot.day_of_week === isoDayOf(day));
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
    if (!item.can_correct) {
      throw new ConflictException({ message: 'This class has not started yet', code: ATTENDANCE_ERRORS.CORRECTION_NOT_STARTED });
    }

    const student = item.roster.find((row) => row.student_id === personId && schoolDateIn(timeZone, row.since) <= date);
    const teacherRecord = item.records.find((record) => record.person_id === personId && record.person_type === AttendancePersonTypeEnum.TEACHER);
    let role: AttendancePersonTypeEnum;
    if (student) {
      role = AttendancePersonTypeEnum.STUDENT;
    } else if (teacherRecord || ref.slot.teacher_id === personId) {
      if (!isManager(tenant)) {
        throw new ForbiddenException({ message: "Only owners, admins and assistants correct a teacher's attendance", code: ATTENDANCE_ERRORS.CORRECTION_TEACHER_RECORD });
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
   * teacher the slots of sections they teach and the slots that name them.
   */
  private async visibleSlots(tenant: Tenant, userId: string): Promise<SlotRef[]> {
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
          return result;
        })();
    return [...bySection].flatMap(([section_id, slots]) => slots.map((slot) => ({ section_id, slot })));
  }

  private async visibleSlot(tenant: Tenant, userId: string, slotId: string, date: string): Promise<SlotRef> {
    const ref = (await this.visibleSlots(tenant, userId)).find((item) => item.slot.id === slotId);
    if (!ref || ref.slot.day_of_week !== isoDayOf(date)) {
      throw new NotFoundException({ message: 'Class not found', code: ATTENDANCE_ERRORS.SESSION_NOT_FOUND });
    }
    return ref;
  }

  private async load(tenant: Tenant, refs: SlotRef[], date: string, timeZone: string, today: string): Promise<Loaded[]> {
    const organizationId = tenant.organizationId;
    const contexts = await this.sessions.contexts(organizationId, refs.map((ref) => ref.section_id));
    const usable = refs.filter((ref) => contexts.get(ref.section_id)?.open);
    if (usable.length === 0) return [];
    const [closedDays, saved, rosters] = await Promise.all([
      this.holidays.closedDays(organizationId, date, date),
      this.sessions.savedSessions(organizationId, usable.map((ref) => ref.slot.id), date, date),
      this.sections.activeStudentsOfSections(organizationId, [...new Set(usable.map((ref) => ref.section_id))]),
    ]);
    const records = await this.sessions.records(organizationId, [...saved.values()].map((session) => session.id));
    const now = this.clock.now();
    const closed = closedDays[0] ?? null;
    return usable.map((ref) => {
      const context = contexts.get(ref.section_id) as SectionContext;
      const session = saved.get(sessionKey(ref.slot.id, date));
      const window = this.sessions.window(context, ref.slot, date, timeZone, session);
      const state = checkInState(now, window);
      return {
        ref,
        context,
        date,
        window,
        state,
        closed,
        session,
        records: session ? (records.get(session.id) ?? []) : [],
        roster: (rosters.get(ref.section_id) ?? []).filter((row) => schoolDateIn(timeZone, row.since) <= date),
        can_correct: !closed && date <= today && now >= window.starts_at,
      };
    });
  }

  private statusOf(item: Loaded, record: AttendanceRecordEntity | undefined): CalendarStatus {
    if (record) return record.status;
    if (item.closed) return 'CLOSED_DAY';
    if (item.state === 'UPCOMING') return 'UPCOMING';
    if (item.context.mode === SectionAttendanceModeEnum.PAPER_REGISTER) return 'NOT_RECORDED';
    return item.state === 'OPEN' ? 'OPEN' : AttendanceStatusEnum.ABSENT;
  }

  private summary(item: Loaded): SessionSummary {
    const counts = { students: item.roster.length, present: 0, late: 0, absent: 0, leave: 0, waiting: 0, flagged: 0 };
    const byPerson = new Map(item.records.map((record) => [record.person_id, record]));
    for (const student of item.roster) {
      const record = byPerson.get(student.student_id);
      const status = this.statusOf(item, record);
      if (status === 'PRESENT') counts.present++;
      else if (status === 'LATE') counts.late++;
      else if (status === 'ABSENT') counts.absent++;
      else if (status === 'LEAVE') counts.leave++;
      else if (status !== 'CLOSED_DAY') counts.waiting++;
      if (record?.flag) counts.flagged++;
    }
    return {
      slot_id: item.ref.slot.id,
      date: item.date,
      section: { id: item.context.section.id, name: item.context.section.name, class_name: item.context.section.class?.class_name ?? '' },
      start_time: item.ref.slot.start_time,
      end_time: item.ref.slot.end_time,
      class_type: item.context.class_type,
      mode: item.context.mode,
      starts_at: item.window.starts_at,
      late_after: item.window.late_after,
      ends_at: item.window.ends_at,
      state: item.state,
      closed: item.closed,
      teacher: item.ref.slot.teacher,
      counts,
      can_correct: item.can_correct,
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
        status: this.statusOf(item, record),
        record: record ? recordView(record) : null,
        corrections: record ? (corrections.get(record.id) ?? []) : [],
        can_correct: canCorrect,
      };
    };
    const students = item.roster.map((student) =>
      row({ id: student.student_id, full_name: student.full_name, roll_no: student.roll_no }, AttendancePersonTypeEnum.STUDENT, item.can_correct),
    );
    // Teachers: the slot's named teacher, and anyone who checked in to it as a teacher.
    const teacherIds = new Set(item.records.filter((record) => record.person_type === AttendancePersonTypeEnum.TEACHER).map((record) => record.person_id));
    if (item.ref.slot.teacher_id) teacherIds.add(item.ref.slot.teacher_id);
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

const isManager = (tenant: Tenant) => !tenant.viaEnrolment && MANAGERS.includes(tenant.memberRole);
