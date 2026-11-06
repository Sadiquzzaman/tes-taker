import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ClosedDay } from 'src/calendar/closed-days';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService, SlotView } from 'src/calendar/routine-slots.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { addDays, daysBetween, isoDayOf, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { ApprovedLeave, ApprovedLeaveService, LeaveCalendar } from './approved-leave.service';
import { AttendanceAlertsService } from './attendance-alerts.service';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { countsFor, SessionWindow } from './class-session-time';
import { ClassSessionsService, SectionContext, sessionKey } from './class-sessions.service';
import { PaperRegisterImportDto } from './dto/paper-register.dto';
import { AttendanceCorrectionEntity } from './entities/attendance-correction.entity';
import {
  AttendancePersonTypeEnum,
  AttendanceRecordEntity,
  AttendanceRecordSourceEnum,
  AttendanceStatusEnum,
} from './entities/attendance-record.entity';
import { ClassSessionEntity, ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum } from './entities/section-attendance-settings.entity';
import { isBlankMark, parseMark, parseMarkColumn, sameRoll, studentColumns } from './paper-register-csv';
import { sameName } from './schedule-csv';
import { isManager, SectionAttendanceService, TEACHER_CORRECTION_DAYS } from './section-attendance.service';

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
/** The reason kept on a correction made by an import (ATT-12). */
export const IMPORT_REASON = 'Paper register import';

/** Why a column, row or cell of the register cannot be used; the web app translates each code (`register.issues`). */
export const REGISTER_ISSUES = {
  // Columns: only a problem when the column has marks (an empty column is ignored).
  COLUMN_UNKNOWN: 'COLUMN_UNKNOWN',
  COLUMN_NOT_IN_MONTH: 'COLUMN_NOT_IN_MONTH',
  NOT_CLASS_DAY: 'NOT_CLASS_DAY',
  CLOSED_DAY: 'CLOSED_DAY',
  CANCELLED: 'CANCELLED',
  NOT_STARTED: 'NOT_STARTED',
  TIME_NEEDED: 'TIME_NEEDED',
  NOT_CLASS_TIME: 'NOT_CLASS_TIME',
  DUPLICATE_COLUMN: 'DUPLICATE_COLUMN',
  // Rows: only a problem when the row has marks.
  STUDENT_MISSING: 'STUDENT_MISSING',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  STUDENT_AMBIGUOUS: 'STUDENT_AMBIGUOUS',
  STUDENT_DUPLICATE: 'STUDENT_DUPLICATE',
  // Cells
  STATUS_INVALID: 'STATUS_INVALID',
  NOT_JOINED: 'NOT_JOINED',
  TOO_OLD: 'TOO_OLD',
} as const;
export type RegisterIssue = (typeof REGISTER_ISSUES)[keyof typeof REGISTER_ISSUES];

/** What the preview tells about a row or cell without stopping the import (`register.notes`). */
export const REGISTER_NOTES = {
  /** The roll number matched a student whose name is written differently. */
  NAME_DIFFERS: 'NAME_DIFFERS',
  /** The file disagrees with the student's own check-in; kept unless `overwrite_check_ins`. */
  SELF_CHECKIN: 'SELF_CHECKIN',
  /** Approved leave is kept whatever the file says. */
  LEAVE_KEPT: 'LEAVE_KEPT',
  /** Absent on a day of approved leave is saved as Leave. */
  ON_LEAVE: 'ON_LEAVE',
} as const;
export type RegisterNote = (typeof REGISTER_NOTES)[keyof typeof REGISTER_NOTES];

/** What applying does to a cell: a new record, a change (a correction), nothing (same), or nothing (kept). */
export type CellChange = 'NEW' | 'CHANGE' | 'SAME' | 'KEEP';

/** One class of the month: a column of the register. */
export interface RegisterClass {
  /** The column header the template and export use: the date, plus the start time when the day has two classes. */
  header: string;
  date: string;
  start_time: string;
  end_time: string;
  slot_id: string;
}

/** `GET /attendance/register/sections/:id?month=`: the template and the export (ATT-17, ATT-13). */
export interface RegisterView {
  section: { id: string; name: string; class_name: string };
  month: string;
  today: string;
  mode: SectionAttendanceModeEnum;
  /** A paper register in an open session: the file can be imported. */
  can_import: boolean;
  classes: RegisterClass[];
  /** Each student's mark per class (same order as `classes`); null = nothing recorded or the class does not count for them. */
  students: { id: string; full_name: string; roll_no: string | null; marks: (AttendanceStatusEnum | null)[] }[];
}

export interface RegisterSection {
  id: string;
  name: string;
  class_name: string;
  mode: SectionAttendanceModeEnum;
}

export interface RegisterColumnResult {
  /** 1-based column of the file. */
  column: number;
  header: string;
  date: string | null;
  start_time: string | null;
  closed: ClosedDay['reason'] | null;
  /** How many cells of the column have something written. */
  marks: number;
  issues: RegisterIssue[];
}

export interface RegisterCellResult {
  column: number;
  value: string;
  status: AttendanceStatusEnum | null;
  old_status: AttendanceStatusEnum | null;
  change: CellChange | null;
  issues: RegisterIssue[];
  notes: RegisterNote[];
}

export interface RegisterRowResult {
  /** The line in the file (the header is line 1). */
  row: number;
  roll_no: string | null;
  name: string | null;
  student: { id: string; full_name: string; roll_no: string | null } | null;
  marks: number;
  issues: RegisterIssue[];
  notes: RegisterNote[];
  /** The cells with something written in them, in classes that can be imported. */
  cells: RegisterCellResult[];
}

export interface RegisterSummary {
  new: number;
  changed: number;
  unchanged: number;
  kept: number;
  /**
   * Self check-ins the file disagrees with: in the preview, those an import would replace with
   * `overwrite_check_ins` (else they are kept); after an import, those replaced.
   */
  check_ins: number;
}

export interface RegisterPreview {
  section: { id: string; name: string; class_name: string };
  month: string;
  /** No column, row or cell with marks has a problem: the file can be imported. */
  valid: boolean;
  columns: RegisterColumnResult[];
  rows: RegisterRowResult[];
  summary: RegisterSummary;
}

/** One class of the month with what is saved for it. */
interface MonthClass {
  slot: SlotView;
  date: string;
  window: SessionWindow;
  session: ClassSessionEntity | undefined;
  /** The class happened (or will): its slot existed before it started, and it is not cancelled. */
  counts: boolean;
  cancelled: boolean;
}

interface Loaded {
  context: SectionContext;
  month: string;
  from: string;
  to: string;
  today: string;
  timeZone: string;
  now: Date;
  closed: Map<string, ClosedDay>;
  classes: MonthClass[];
  roster: { student_id: string; full_name: string; roll_no: string | null; since: Date }[];
  /** Saved records by session id, then person id. */
  records: Map<string, Map<string, AttendanceRecordEntity>>;
  leave: LeaveCalendar;
}

/** A planned write: the cell, its class and student, and the mark the file gives. */
interface Planned {
  cell: RegisterCellResult;
  item: MonthClass;
  studentId: string;
  status: AttendanceStatusEnum;
}

/**
 * The paper register (ATT-17) and the monthly register export (ATT-13): a CSV per section and
 * month with one row per student (roll number and name) and one column per class day, filled in
 * with P, L, A or Leave (English or Bangla). The template and the export are the same format (the
 * export has the marks filled in). An upload is checked column by column, row by row and cell by
 * cell before anything is saved; applying it is idempotent (the same file twice changes nothing):
 * a new mark saves a record (source IMPORT), a different mark corrects the record with a trail in
 * `attendance_corrections`, a blank cell changes nothing. Approved leave is never overwritten, and
 * a self check-in is overwritten only when the caller says so after seeing it in the preview. Only
 * paper-register sections take an import. Afterwards the guardians' absence SMS held back for
 * those days go out (`AttendanceAlertsService.releaseHeldAbsences`); there is no Late SMS for an
 * import. Who: as for the class view (owners, admins and assistants every section; a teacher the
 * sections they teach or are named on); a teacher changes a saved mark only within the correction limit.
 */
@Injectable()
export class PaperRegisterService {
  private readonly logger = new Logger(PaperRegisterService.name);

  constructor(
    private readonly classView: SectionAttendanceService,
    private readonly sessions: ClassSessionsService,
    private readonly sections: SectionsService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly leave: ApprovedLeaveService,
    private readonly alerts: AttendanceAlertsService,
    private readonly audit: AuditService,
    private readonly clock: AttendanceClock,
    private readonly dataSource: DataSource,
  ) {}

  /** The sections whose register the caller may download (and, for paper registers, import). */
  async sectionList(tenant: Tenant, userId: string): Promise<RegisterSection[]> {
    const ids = await this.visibleSectionIds(tenant, userId);
    const contexts = await this.sessions.contexts(tenant.organizationId, [...ids]);
    return [...contexts.values()]
      .filter((context) => context.open)
      .map((context) => ({ ...sectionOf(context), mode: context.mode }))
      .sort((a, b) => `${a.class_name} ${a.name}`.localeCompare(`${b.class_name} ${b.name}`, undefined, { numeric: true }));
  }

  /** The register of a month: the template (marks ignored) and the export (ATT-13, same format). */
  async register(tenant: Tenant, userId: string, sectionId: string, month: string): Promise<RegisterView> {
    const loaded = await this.load(tenant, userId, sectionId, month);
    const classes = loaded.classes.filter((item) => item.counts && !loaded.closed.has(item.date));
    const perDay = new Map<string, number>();
    for (const item of classes) perDay.set(item.date, (perDay.get(item.date) ?? 0) + 1);
    return {
      section: sectionOf(loaded.context),
      month,
      today: loaded.today,
      mode: loaded.context.mode,
      can_import: loaded.context.mode === SectionAttendanceModeEnum.PAPER_REGISTER,
      classes: classes.map((item) => ({
        header: (perDay.get(item.date) ?? 0) > 1 ? `${item.date} ${item.slot.start_time}` : item.date,
        date: item.date,
        start_time: item.slot.start_time,
        end_time: item.slot.end_time,
        slot_id: item.slot.id,
      })),
      students: loaded.roster.map((student) => ({
        id: student.student_id,
        full_name: student.full_name,
        roll_no: student.roll_no,
        marks: classes.map((item) => {
          if (!countsFor(item.window, null, student.since)) return null;
          const record = item.session ? loaded.records.get(item.session.id)?.get(student.student_id) : undefined;
          if (record) return record.status;
          return loaded.leave.on(student.student_id, item.date) ? AttendanceStatusEnum.LEAVE : null;
        }),
      })),
    };
  }

  async preview(tenant: Tenant, userId: string, sectionId: string, dto: PaperRegisterImportDto): Promise<RegisterPreview> {
    const loaded = await this.load(tenant, userId, sectionId, dto.month);
    this.mustImport(loaded);
    return this.check(tenant, loaded, dto).preview;
  }

  async import(tenant: Tenant, userId: string, sectionId: string, dto: PaperRegisterImportDto): Promise<RegisterPreview> {
    const organizationId = tenant.organizationId;
    const loaded = await this.load(tenant, userId, sectionId, dto.month);
    this.mustImport(loaded);
    const { preview, planned } = this.check(tenant, loaded, dto);
    if (!preview.valid) {
      throw new BadRequestException({ message: 'Some rows have problems; fix the file and check it again', code: ATTENDANCE_ERRORS.REGISTER_INVALID });
    }
    const overwrite = dto.overwrite_check_ins === true;
    const reason = dto.file_name?.trim() ? `${IMPORT_REASON} (${dto.file_name.trim().slice(0, 100)})` : IMPORT_REASON;

    const summary: RegisterSummary = { new: 0, changed: 0, unchanged: 0, kept: 0, check_ins: 0 };
    const written = new Set<string>();
    await this.dataSource.transaction(async (manager) => {
      // One import of a section at a time; corrections take a row lock on the records below.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`attendance.register:${loaded.context.section.id}`]);
      const byClass = new Map<MonthClass, Planned[]>();
      for (const plan of planned) byClass.set(plan.item, [...(byClass.get(plan.item) ?? []), plan]);
      for (const [item, plans] of byClass) {
        const session = await this.lockedSession(manager, organizationId, loaded, item);
        const records = manager.getRepository(AttendanceRecordEntity);
        const saved = await records.find({
          where: { organization_id: organizationId, class_attendance_id: session.id, person_id: In(plans.map((plan) => plan.studentId)) },
          lock: { mode: 'pessimistic_write' },
        });
        const byPerson = new Map(saved.map((record) => [record.person_id, record]));
        const now = new Date();
        for (const plan of plans) {
          const existing = byPerson.get(plan.studentId);
          const decision = decide(plan.status, existing, loaded.leave.on(plan.studentId, item.date));
          if (decision.change === 'SAME') {
            summary.unchanged++;
            continue;
          }
          if (decision.change === 'KEEP' || (decision.notes.includes(REGISTER_NOTES.SELF_CHECKIN) && !overwrite)) {
            summary.kept++;
            continue;
          }
          const late = decision.status === AttendanceStatusEnum.LATE && existing?.status === AttendanceStatusEnum.LATE ? existing.late_minutes : null;
          if (!existing) {
            const inserted = await records
              .createQueryBuilder()
              .insert()
              .into(AttendanceRecordEntity)
              .values({
                organization_id: organizationId,
                class_attendance_id: session.id,
                date: item.date,
                person_id: plan.studentId,
                person_type: AttendancePersonTypeEnum.STUDENT,
                status: decision.status,
                source: AttendanceRecordSourceEnum.IMPORT,
                leave_request_id: decision.leave_request_id,
                updated_by: userId,
                updated_at: now,
              })
              .orIgnore()
              .returning('id')
              .execute();
            if ((inserted.raw as unknown[]).length === 0) {
              throw new ConflictException({ message: 'The register changed while it was imported; check the file again', code: ATTENDANCE_ERRORS.REGISTER_CHANGED });
            }
            summary.new++;
          } else {
            await records.update(
              { id: existing.id },
              {
                status: decision.status,
                late_minutes: late,
                source: AttendanceRecordSourceEnum.IMPORT,
                leave_request_id: decision.leave_request_id ?? existing.leave_request_id,
                updated_by: userId,
                updated_at: now,
              },
            );
            await manager.getRepository(AttendanceCorrectionEntity).insert({
              organization_id: organizationId,
              record_id: existing.id,
              old_status: existing.status,
              new_status: decision.status,
              reason,
              corrected_by: userId,
            });
            if (existing.source === AttendanceRecordSourceEnum.SELF) summary.check_ins++;
            else summary.changed++;
          }
          written.add(item.date);
        }
      }
    });

    this.audit.record({
      action: AUDIT_ACTIONS.ATTENDANCE_IMPORT,
      organizationId,
      actorId: userId,
      entityType: 'section',
      entityId: loaded.context.section.id,
      after: {
        month: dto.month,
        file_name: dto.file_name?.trim() || null,
        ...summary,
        overwrite_check_ins: overwrite,
        dates: [...written].sort(),
      },
      reason: IMPORT_REASON,
    });

    // The absence SMS held back until the register was in (P3-04); a failure here never undoes the import.
    if (written.size > 0) {
      try {
        await this.alerts.releaseHeldAbsences(organizationId, [...written], loaded.roster.map((row) => row.student_id));
      } catch (error) {
        this.logger.error(`Absence SMS after a register import failed: ${(error as Error).message}`);
      }
    }
    return { ...preview, summary };
  }

  private mustImport(loaded: Loaded): void {
    if (loaded.context.mode !== SectionAttendanceModeEnum.PAPER_REGISTER) {
      throw new ConflictException({ message: 'This section uses self check-in; switch it to a paper register in Class setup first', code: ATTENDANCE_ERRORS.REGISTER_SELF_CHECKIN });
    }
  }

  /** Every column, row and cell checked, and the writes a valid file makes. */
  private check(tenant: Tenant, loaded: Loaded, dto: PaperRegisterImportDto): { preview: RegisterPreview; planned: Planned[] } {
    const { roll, name } = studentColumns(dto.header);
    if (roll < 0 && name < 0) {
      throw new BadRequestException({ message: 'The file needs a roll number or a name column', code: ATTENDANCE_ERRORS.REGISTER_COLUMNS_MISSING });
    }
    const manager = isManager(tenant);
    const width = Math.max(dto.header.length, ...dto.rows.map((row) => row.cells.length));

    // Columns: each class-day header matched to one class of the month.
    const columns: RegisterColumnResult[] = [];
    const classOf = new Map<number, MonthClass>();
    const taken = new Set<MonthClass>();
    for (let index = 0; index < width; index++) {
      if (index === roll || index === name) continue;
      const header = (dto.header[index] ?? '').trim();
      const marks = dto.rows.filter((row) => !isBlankMark(row.cells[index])).length;
      if (!header && marks === 0) continue;
      const result: RegisterColumnResult = { column: index + 1, header, date: null, start_time: null, closed: null, marks, issues: [] };
      columns.push(result);
      const item = this.matchColumn(loaded, header, result);
      if (!item) continue;
      if (taken.has(item)) {
        result.issues.push(REGISTER_ISSUES.DUPLICATE_COLUMN);
        continue;
      }
      taken.add(item);
      classOf.set(index, item);
    }

    // Rows: each line matched to one student of the section.
    const rows: RegisterRowResult[] = [];
    const planned: Planned[] = [];
    const seen = new Set<string>();
    const summary: RegisterSummary = { new: 0, changed: 0, unchanged: 0, kept: 0, check_ins: 0 };
    const tooOld = addDays(loaded.today, -TEACHER_CORRECTION_DAYS);
    dto.rows.forEach((line, lineIndex) => {
      const cells = line.cells;
      const rollNo = roll >= 0 ? cells[roll]?.trim() || null : null;
      const fullName = name >= 0 ? cells[name]?.trim() || null : null;
      const markIndexes = columns.map((column) => column.column - 1).filter((index) => !isBlankMark(cells[index]));
      if (!rollNo && !fullName && markIndexes.length === 0) return;
      const row: RegisterRowResult = { row: lineIndex + 2, roll_no: rollNo, name: fullName, student: null, marks: markIndexes.length, issues: [], notes: [], cells: [] };
      rows.push(row);

      const student = this.matchStudent(loaded, rollNo, fullName, row);
      if (!student) return;
      if (seen.has(student.student_id)) {
        row.issues.push(REGISTER_ISSUES.STUDENT_DUPLICATE);
        return;
      }
      seen.add(student.student_id);
      row.student = { id: student.student_id, full_name: student.full_name, roll_no: student.roll_no };

      for (const index of markIndexes) {
        const item = classOf.get(index);
        if (!item) continue; // the column's own problem is reported on the column
        const value = (cells[index] ?? '').trim();
        const status = parseMark(value);
        const cell: RegisterCellResult = { column: index + 1, value, status: status ?? null, old_status: null, change: null, issues: [], notes: [] };
        row.cells.push(cell);
        if (!status) {
          cell.issues.push(REGISTER_ISSUES.STATUS_INVALID);
          continue;
        }
        if (!countsFor(item.window, null, student.since)) {
          cell.issues.push(REGISTER_ISSUES.NOT_JOINED);
          continue;
        }
        const existing = item.session ? loaded.records.get(item.session.id)?.get(student.student_id) : undefined;
        const decision = decide(status, existing, loaded.leave.on(student.student_id, item.date));
        Object.assign(cell, { status: decision.status, old_status: existing?.status ?? null, change: decision.change, notes: decision.notes });
        // Changing a saved mark is a correction: teachers have the 7-day limit (first marks have none).
        if (decision.change === 'CHANGE' && !manager && item.date < tooOld) {
          cell.issues.push(REGISTER_ISSUES.TOO_OLD);
          continue;
        }
        if (decision.change === 'NEW') summary.new++;
        else if (decision.change === 'SAME') summary.unchanged++;
        else if (decision.change === 'KEEP') summary.kept++;
        else if (decision.notes.includes(REGISTER_NOTES.SELF_CHECKIN)) summary.check_ins++;
        else summary.changed++;
        planned.push({ cell, item, studentId: student.student_id, status });
      }
    });

    const valid =
      columns.every((column) => column.marks === 0 || column.issues.length === 0) &&
      rows.every((row) => (row.marks === 0 || row.issues.length === 0) && row.cells.every((cell) => cell.issues.length === 0));
    return {
      preview: { section: sectionOf(loaded.context), month: loaded.month, valid, columns, rows, summary },
      planned: valid ? planned : [],
    };
  }

  /** The class a column header names, or null with the column's issue. */
  private matchColumn(loaded: Loaded, header: string, result: RegisterColumnResult): MonthClass | null {
    const parsed = parseMarkColumn(header, loaded.month);
    if (!parsed) {
      result.issues.push(REGISTER_ISSUES.COLUMN_UNKNOWN);
      return null;
    }
    result.date = parsed.date;
    result.start_time = parsed.time;
    if (parsed.date < loaded.from || parsed.date > loaded.to) {
      result.issues.push(REGISTER_ISSUES.COLUMN_NOT_IN_MONTH);
      return null;
    }
    const closed = loaded.closed.get(parsed.date);
    if (closed) {
      result.closed = closed.reason;
      result.issues.push(REGISTER_ISSUES.CLOSED_DAY);
      return null;
    }
    const ofDay = loaded.classes.filter((item) => item.date === parsed.date);
    if (ofDay.length === 0) {
      result.issues.push(REGISTER_ISSUES.NOT_CLASS_DAY);
      return null;
    }
    let item: MonthClass | undefined;
    if (parsed.time) {
      item = ofDay.find((candidate) => candidate.slot.start_time === parsed.time);
      if (!item) {
        result.issues.push(REGISTER_ISSUES.NOT_CLASS_TIME);
        return null;
      }
    } else if (ofDay.length > 1) {
      result.issues.push(REGISTER_ISSUES.TIME_NEEDED);
      return null;
    } else {
      item = ofDay[0];
    }
    result.start_time = item.slot.start_time;
    if (item.cancelled) {
      result.issues.push(REGISTER_ISSUES.CANCELLED);
      return null;
    }
    if (loaded.now < item.window.starts_at) {
      result.issues.push(REGISTER_ISSUES.NOT_STARTED);
      return null;
    }
    return item;
  }

  /** The student a line names: by roll number, else by name (unique in the section). */
  private matchStudent(loaded: Loaded, rollNo: string | null, fullName: string | null, row: RegisterRowResult): Loaded['roster'][number] | null {
    if (rollNo) {
      const matches = loaded.roster.filter((student) => sameRoll(student.roll_no, rollNo));
      if (matches.length > 1) {
        row.issues.push(REGISTER_ISSUES.STUDENT_AMBIGUOUS);
        return null;
      }
      if (matches.length === 1) {
        if (fullName && !sameName(matches[0].full_name, fullName)) row.notes.push(REGISTER_NOTES.NAME_DIFFERS);
        return matches[0];
      }
      row.issues.push(REGISTER_ISSUES.STUDENT_NOT_FOUND);
      return null;
    }
    if (!fullName) {
      row.issues.push(REGISTER_ISSUES.STUDENT_MISSING);
      return null;
    }
    const matches = loaded.roster.filter((student) => sameName(student.full_name, fullName));
    if (matches.length !== 1) {
      row.issues.push(matches.length === 0 ? REGISTER_ISSUES.STUDENT_NOT_FOUND : REGISTER_ISSUES.STUDENT_AMBIGUOUS);
      return null;
    }
    return matches[0];
  }

  /** The class's session row under a row lock, made when the class has none yet; refused if it was cancelled meanwhile. */
  private async lockedSession(manager: EntityManager, organizationId: string, loaded: Loaded, item: MonthClass): Promise<ClassSessionEntity> {
    const created = item.session ?? (await this.sessions.ensureSession(manager, organizationId, loaded.context.section.id, item.slot.id, item.date, item.window));
    const session = await manager.getRepository(ClassSessionEntity).findOneOrFail({ where: { id: created.id }, lock: { mode: 'pessimistic_write' } });
    if (session.status === ClassSessionStatusEnum.CANCELLED) {
      throw new ConflictException({ message: 'The register changed while it was imported; check the file again', code: ATTENDANCE_ERRORS.REGISTER_CHANGED });
    }
    return session;
  }

  /** Section ids the caller may see: the class view's slots (every section for owners, admins and assistants). */
  private async visibleSectionIds(tenant: Tenant, userId: string): Promise<Set<string>> {
    return new Set((await this.classView.visibleSlots(tenant, userId)).map((ref) => ref.section_id));
  }

  private async load(tenant: Tenant, userId: string, sectionId: string, month: string): Promise<Loaded> {
    const organizationId = tenant.organizationId;
    const match = MONTH.exec(month ?? '');
    if (!match) throw new BadRequestException({ message: 'Choose a month as YYYY-MM', code: ATTENDANCE_ERRORS.REGISTER_MONTH_INVALID });
    const visible = await this.visibleSectionIds(tenant, userId);
    const context = visible.has(sectionId) ? (await this.sessions.contexts(organizationId, [sectionId])).get(sectionId) : undefined;
    if (!context) throw new NotFoundException({ message: 'Section not found', code: ATTENDANCE_ERRORS.REGISTER_SECTION_NOT_FOUND });
    if (!context.open) throw new ConflictException({ message: 'This academic session is closed', code: ATTENDANCE_ERRORS.REGISTER_SESSION_CLOSED });

    const [year, monthNo] = [Number(match[1]), Number(match[2])];
    const from = `${month}-01`;
    const to = addDays(monthNo === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNo + 1).padStart(2, '0')}-01`, -1);
    const now = this.clock.now();
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, now);
    const slots = (await this.slots.activeBySection(organizationId, [sectionId])).get(sectionId) ?? [];
    const [closedDays, added, saved, rosters, leave] = await Promise.all([
      this.holidays.closedDays(organizationId, from, to),
      this.slots.createdAt(organizationId, slots.map((slot) => slot.id)),
      this.sessions.savedSessions(organizationId, slots.map((slot) => slot.id), from, to),
      this.sections.activeStudentsOfSections(organizationId, [sectionId]),
      this.leave.between(organizationId, from, to),
    ]);
    const recordRows = await this.sessions.records(organizationId, [...saved.values()].map((session) => session.id));
    const records = new Map<string, Map<string, AttendanceRecordEntity>>();
    for (const [sessionId, rows] of recordRows) {
      records.set(sessionId, new Map(rows.filter((row) => row.person_type === AttendancePersonTypeEnum.STUDENT).map((row) => [row.person_id, row])));
    }

    const classes: MonthClass[] = [];
    for (let i = 0; i < daysBetween(from, to); i++) {
      const date = addDays(from, i);
      for (const slot of slots) {
        if (slot.day_of_week !== isoDayOf(date)) continue;
        const session = saved.get(sessionKey(slot.id, date));
        const window = this.sessions.window(context, slot, date, timeZone, session);
        const cancelled = session?.status === ClassSessionStatusEnum.CANCELLED;
        // A class exists only once its slot was added before it started (as for the class view and the closing job).
        const exists = countsFor(window, added.get(slot.id)) || Boolean(session);
        if (!exists) continue;
        classes.push({ slot, date, window, session, counts: !cancelled, cancelled });
      }
    }
    classes.sort((a, b) => a.window.starts_at.getTime() - b.window.starts_at.getTime());

    return {
      context,
      month,
      from,
      to,
      today,
      timeZone,
      now,
      closed: new Map(closedDays.map((day) => [day.date, day])),
      classes,
      roster: rosters.get(sectionId) ?? [],
      records,
      leave,
    };
  }
}

/**
 * What a mark does to a student's record of one class (also the rule the preview shows):
 * - approved leave that day: Absent (or Leave) is saved as Leave linked to the request; Present and
 *   Late are kept as written (as for a check-in on a day of leave, P3-06);
 * - a record saved from approved leave is never changed (LEAVE_KEPT);
 * - the same status is no change; another status is a correction (a self check-in says so).
 */
export function decide(
  mark: AttendanceStatusEnum,
  existing: Pick<AttendanceRecordEntity, 'status' | 'source' | 'leave_request_id'> | undefined,
  leave: ApprovedLeave | null,
): { change: CellChange; status: AttendanceStatusEnum; leave_request_id: string | null; notes: RegisterNote[] } {
  const toLeave = Boolean(leave) && (mark === AttendanceStatusEnum.ABSENT || mark === AttendanceStatusEnum.LEAVE);
  const status = toLeave ? AttendanceStatusEnum.LEAVE : mark;
  const leaveId = toLeave ? (leave as ApprovedLeave).id : null;
  const notes: RegisterNote[] = mark === AttendanceStatusEnum.ABSENT && toLeave ? [REGISTER_NOTES.ON_LEAVE] : [];
  if (!existing) return { change: 'NEW', status, leave_request_id: leaveId, notes };
  if (existing.status === AttendanceStatusEnum.LEAVE && existing.leave_request_id) {
    return status === AttendanceStatusEnum.LEAVE
      ? { change: 'SAME', status, leave_request_id: existing.leave_request_id, notes: [] }
      : { change: 'KEEP', status: existing.status, leave_request_id: existing.leave_request_id, notes: [REGISTER_NOTES.LEAVE_KEPT] };
  }
  if (existing.status === status) return { change: 'SAME', status, leave_request_id: null, notes: [] };
  if (existing.source === AttendanceRecordSourceEnum.SELF) notes.push(REGISTER_NOTES.SELF_CHECKIN);
  return { change: 'CHANGE', status, leave_request_id: leaveId, notes };
}

const sectionOf = (context: SectionContext) => ({
  id: context.section.id,
  name: context.section.name,
  class_name: context.section.class?.class_name ?? '',
});
