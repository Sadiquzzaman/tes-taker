import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClosedDay } from 'src/calendar/closed-days';
import { HolidaysService } from 'src/calendar/holidays.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { daysBetween, isSchoolDate, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { AttendanceCounts, attendancePct, countMark, DayMark, dayMark, emptyCounts } from './attendance-report';
import { ClassSessionsService } from './class-sessions.service';
import { AttendancePersonTypeEnum, AttendanceRecordEntity, AttendanceStatusEnum } from './entities/attendance-record.entity';
import { ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum } from './entities/section-attendance-settings.entity';
import { CalendarStatus, clockIn } from './my-attendance.service';
import { PaperRegisterService, RegisterView } from './paper-register.service';
import { SectionAttendanceService, SessionSummary } from './section-attendance.service';

/** The teacher report covers at most this many days (a month, or one day for the daily summary). */
export const TEACHER_REPORT_MAX_DAYS = 31;

type SectionRef = { id: string; name: string; class_name: string };

/** One student on the daily summary: their mark in each class of the day and their day. */
export interface DailyStudent {
  id: string;
  full_name: string;
  roll_no: string | null;
  /** Same order as the section's `classes`; null when the class does not count for them (joined later). */
  marks: (CalendarStatus | null)[];
  /** null when no class counted for them that day (all cancelled, for example). */
  day: DayMark | null;
}

export interface DailySection {
  section: SectionRef;
  mode: SectionAttendanceModeEnum;
  classes: (Pick<SessionSummary, 'slot_id' | 'start_time' | 'end_time' | 'teacher' | 'state' | 'counts'> & { cancelled: boolean })[];
  /** Students by their day; `missed_some`: present or late, but absent from at least one class. */
  counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; missed_some: number };
  students: DailyStudent[];
}

/** `GET /attendance/reports/daily`: the daily summary per section (ATT-13). */
export interface DailyReport {
  date: string;
  today: string;
  time_zone: string;
  closed: ClosedDay | null;
  sections: DailySection[];
}

/** `GET /attendance/reports/sections/:id/month`: the monthly register with each student's totals (ATT-13). */
export interface MonthlyReport extends Omit<RegisterView, 'students'> {
  /** The class days of the month (one column of the printed register each), with how many classes each had. */
  days: { date: string; classes: number }[];
  students: (RegisterView['students'][number] & {
    /** Same order as `days`. */
    days: (DayMark | null)[];
    counts: AttendanceCounts;
    attendance_pct: number | null;
  })[];
  /** The whole section's classes in the month. */
  counts: AttendanceCounts;
  attendance_pct: number | null;
}

export interface TeacherClass {
  date: string;
  section: SectionRef;
  start_time: string;
  end_time: string;
  status: AttendanceStatusEnum;
  late_minutes: number | null;
}

/** `GET /attendance/reports/teachers`: teachers' attendance (ATT-11, ATT-13), owners and admins only. */
export interface TeacherReport {
  from: string;
  to: string;
  today: string;
  teachers: {
    teacher: { id: string; full_name: string };
    counts: AttendanceCounts;
    attendance_pct: number | null;
    /** Minutes late, added up over the late classes. */
    late_minutes: number;
    /** The classes that were not on time (late, absent, leave), oldest first. */
    classes: TeacherClass[];
  }[];
}

/** A student's attendance over a period, for Performance (Epic 3, design §8.11 F3). */
export interface StudentAttendance {
  counts: AttendanceCounts;
  attendance_pct: number | null;
}

/**
 * Attendance reports (ATT-13): the daily summary per section, the monthly register with each
 * student's totals and attendance %, the teacher report (owners and admins, ATT-11), and the
 * attendance % that Performance reads (`studentAttendance`). Read-only; they are worked out from
 * the class records on request (no summary table: see `docs/design.md`, P3-07). Who: sections as
 * on the class view and the register (owners, admins and assistants every section; a teacher the
 * sections they teach or are named on); the teacher report is checked by the controller.
 */
@Injectable()
export class AttendanceReportsService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    private readonly classView: SectionAttendanceService,
    private readonly register: PaperRegisterService,
    private readonly sessions: ClassSessionsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly clock: AttendanceClock,
  ) {}

  async daily(tenant: Tenant, userId: string, date?: string, sectionId?: string): Promise<DailyReport> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const day = validDate(date ?? today);
    const visible = new Set((await this.classView.visibleSlots(tenant, userId)).map((ref) => ref.section_id));
    if (sectionId && !visible.has(sectionId)) {
      throw new NotFoundException({ message: 'Section not found', code: ATTENDANCE_ERRORS.REPORT_SECTION_NOT_FOUND });
    }
    const ids = sectionId ? [sectionId] : [...visible];
    const [classes, closedDays] = await Promise.all([this.classView.dayClasses(tenant, ids, day), this.holidays.closedDays(organizationId, day, day)]);

    const bySection = new Map<string, typeof classes>();
    for (const item of classes) bySection.set(item.summary.section.id, [...(bySection.get(item.summary.section.id) ?? []), item]);
    const sections: DailySection[] = [];
    for (const items of bySection.values()) {
      // Every student of the day's classes, in roll order (each class's list is), with a mark per class.
      const students = new Map<string, DailyStudent>();
      items.forEach((item, index) => {
        for (const row of item.students) {
          const student = students.get(row.id) ?? { id: row.id, full_name: row.full_name, roll_no: row.roll_no, marks: items.map(() => null), day: null };
          student.marks[index] = row.status;
          students.set(row.id, student);
        }
      });
      const counts = { students: students.size, present: 0, late: 0, absent: 0, leave: 0, waiting: 0, missed_some: 0 };
      for (const student of students.values()) {
        student.day = dayMark(student.marks);
        if (!student.day) continue;
        const key = student.day.status.toLowerCase() as 'present' | 'late' | 'absent' | 'leave' | 'waiting';
        counts[key]++;
        if ((student.day.status === 'PRESENT' || student.day.status === 'LATE') && student.day.missed > 0) counts.missed_some++;
      }
      const first = items[0].summary;
      sections.push({
        section: first.section,
        mode: first.mode,
        classes: items.map(({ summary }) => ({
          slot_id: summary.slot_id,
          start_time: summary.start_time,
          end_time: summary.end_time,
          teacher: summary.teacher,
          state: summary.state,
          counts: summary.counts,
          cancelled: Boolean(summary.cancelled),
        })),
        counts,
        students: [...students.values()],
      });
    }
    sections.sort((a, b) => sectionLabel(a.section).localeCompare(sectionLabel(b.section), undefined, { numeric: true }));
    return { date: day, today, time_zone: timeZone, closed: closedDays[0] ?? null, sections };
  }

  /** The month's register (P3-05's view, so the grid and its CSV are the same) with each student's day marks, counts and %. */
  async month(tenant: Tenant, userId: string, sectionId: string, month: string): Promise<MonthlyReport> {
    const view = await this.register.register(tenant, userId, sectionId, month);
    const days: { date: string; columns: number[] }[] = [];
    view.classes.forEach((item, index) => {
      const last = days[days.length - 1];
      if (last?.date === item.date) last.columns.push(index);
      else days.push({ date: item.date, columns: [index] });
    });
    const total = emptyCounts();
    const students = view.students.map((student) => {
      const counts = emptyCounts();
      for (const mark of student.marks) {
        countMark(counts, mark);
        countMark(total, mark);
      }
      return {
        ...student,
        days: days.map((day) => dayMark(day.columns.map((index) => student.marks[index]))),
        counts,
        attendance_pct: attendancePct(counts),
      };
    });
    return {
      ...view,
      days: days.map((day) => ({ date: day.date, classes: day.columns.length })),
      students,
      counts: total,
      attendance_pct: attendancePct(total),
    };
  }

  /** Teachers' classes from `from` to `to` (at most 31 days): counts, %, minutes late and the classes not on time. */
  async teachers(tenant: Tenant, from?: string, to?: string): Promise<TeacherReport> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, this.clock.now());
    const start = validDate(from ?? today);
    const end = validDate(to ?? start);
    if (end < start) throw new BadRequestException({ message: 'The end date is before the start date', code: ATTENDANCE_ERRORS.REPORT_RANGE_INVALID });
    if (daysBetween(start, end) > TEACHER_REPORT_MAX_DAYS) {
      throw new BadRequestException({
        message: `Choose at most ${TEACHER_REPORT_MAX_DAYS} days`,
        code: ATTENDANCE_ERRORS.REPORT_RANGE_TOO_LONG,
        details: { days: TEACHER_REPORT_MAX_DAYS },
      });
    }

    const saved = await this.recordRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.session', 's')
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.person_type = :teacher', { teacher: AttendancePersonTypeEnum.TEACHER })
      .andWhere('r.date BETWEEN :start AND :end', { start, end })
      .andWhere('s.status <> :cancelled', { cancelled: ClassSessionStatusEnum.CANCELLED })
      .orderBy('s.starts_at', 'ASC')
      .getMany();
    const records = saved.flatMap((record) => (record.session ? [{ ...record, session: record.session }] : []));
    const teacherIds = [...new Set(records.map((record) => record.person_id))];
    const [names, contexts] = await Promise.all([
      teacherIds.length === 0
        ? Promise.resolve([] as UserEntity[])
        : this.recordRepo.manager.getRepository(UserEntity).find({ where: { id: In(teacherIds) }, select: ['id', 'full_name'] }),
      this.sessions.contexts(organizationId, records.map((record) => record.session.section_id)),
    ]);
    const nameOf = new Map(names.map((user) => [user.id, user.full_name]));

    const byTeacher = new Map<string, TeacherReport['teachers'][number]>();
    for (const record of records) {
      const row = byTeacher.get(record.person_id) ?? {
        teacher: { id: record.person_id, full_name: nameOf.get(record.person_id) ?? '' },
        counts: emptyCounts(),
        attendance_pct: null,
        late_minutes: 0,
        classes: [],
      };
      byTeacher.set(record.person_id, row);
      countMark(row.counts, record.status);
      if (record.status === AttendanceStatusEnum.LATE) row.late_minutes += record.late_minutes ?? 0;
      if (record.status === AttendanceStatusEnum.PRESENT) continue;
      const section = contexts.get(record.session.section_id)?.section;
      row.classes.push({
        date: record.date,
        section: { id: record.session.section_id, name: section?.name ?? '', class_name: section?.class?.class_name ?? '' },
        start_time: clockIn(record.session.starts_at, timeZone),
        end_time: clockIn(record.session.ends_at, timeZone),
        status: record.status,
        late_minutes: record.late_minutes,
      });
    }
    const teachers = [...byTeacher.values()].map((row) => ({ ...row, attendance_pct: attendancePct(row.counts) }));
    teachers.sort((a, b) => a.teacher.full_name.localeCompare(b.teacher.full_name));
    return { from: start, to: end, today, teachers };
  }

  /**
   * Each student's attendance from `from` to `to` (school dates, inclusive), for Performance
   * (Epic 3): the saved class records, cancelled classes left out, with the % of "My attendance"
   * (`attendancePct`). One grouped query on `(organization_id, person_id, date)`. Students with no
   * record get zero counts and a null %. No access check; the caller checks.
   */
  async studentAttendance(organizationId: string, studentIds: string[], from: string, to: string): Promise<Map<string, StudentAttendance>> {
    const ids = [...new Set(studentIds)];
    const counts = new Map<string, AttendanceCounts>(ids.map((id) => [id, emptyCounts()]));
    if (ids.length > 0) {
      const rows = (await this.recordRepo
        .createQueryBuilder('r')
        .innerJoin('r.session', 's')
        .select('r.person_id', 'person_id')
        .addSelect('r.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .where('r.organization_id = :organizationId', { organizationId })
        .andWhere('r.person_id IN (:...ids)', { ids })
        .andWhere('r.person_type = :student', { student: AttendancePersonTypeEnum.STUDENT })
        .andWhere('r.date BETWEEN :from AND :to', { from, to })
        .andWhere('s.status <> :cancelled', { cancelled: ClassSessionStatusEnum.CANCELLED })
        .groupBy('r.person_id')
        .addGroupBy('r.status')
        .getRawMany()) as { person_id: string; status: AttendanceStatusEnum; count: number }[];
      for (const row of rows) {
        const own = counts.get(row.person_id);
        if (own) countMark(own, row.status, Number(row.count));
      }
    }
    return new Map([...counts].map(([id, own]) => [id, { counts: own, attendance_pct: attendancePct(own) }]));
  }
}

const sectionLabel = (section: SectionRef) => `${section.class_name} ${section.name}`;

function validDate(date: string): string {
  if (!isSchoolDate(date)) throw new BadRequestException({ message: 'Choose a real date', code: ATTENDANCE_ERRORS.REPORT_DATE_INVALID });
  return date;
}
