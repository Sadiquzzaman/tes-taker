import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService } from 'src/calendar/routine-slots.service';
import { ClosedDay } from 'src/calendar/closed-days';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { addDays, daysBetween, isoDayOf, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { ApprovedLeaveService } from './approved-leave.service';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { checkInState, countsFor } from './class-session-time';
import { ClassSessionsService, recordView, RecordView, SectionContext, sessionKey } from './class-sessions.service';
import { CheckInService } from './check-in.service';
import { AttendancePersonTypeEnum, AttendanceRecordEntity, AttendanceStatusEnum } from './entities/attendance-record.entity';
import { ClassSessionEntity, ClassSessionStatusEnum } from './entities/class-session.entity';
import { SectionAttendanceModeEnum } from './entities/section-attendance-settings.entity';

/**
 * A class on the calendar (spec Epic 1, "Calendar colours"): UPCOMING (grey), OPEN (check-in open
 * now), PRESENT (green P), LATE (yellow L), ABSENT (red A), LEAVE (blue), CLOSED_DAY (striped:
 * weekly off day or holiday), CANCELLED (striped: the class was cancelled for that day, ATT-19),
 * NOT_RECORDED (a paper-register class whose register is not in yet).
 */
export type CalendarStatus = 'UPCOMING' | 'OPEN' | 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'CLOSED_DAY' | 'CANCELLED' | 'NOT_RECORDED';

export interface CalendarClass {
  slot_id: string;
  role: AttendancePersonTypeEnum;
  section: { id: string; name: string; class_name: string };
  start_time: string;
  end_time: string;
  status: CalendarStatus;
  record: RecordView | null;
}

export interface CalendarDay {
  date: string;
  closed: ClosedDay | null;
  classes: CalendarClass[];
}

/** `GET /attendance/me/calendar`. */
export interface MyCalendarView {
  month: string;
  today: string;
  time_zone: string;
  days: CalendarDay[];
  /** Classes counted in the month so far (ATT-18; monthly summaries count classes). */
  counts: { present: number; late: number; absent: number; leave: number };
  /** (present + late) / (present + late + absent), whole percent; null before any class counts. Leave is not held against anyone. */
  attendance_pct: number | null;
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * "My attendance" (ATT-18): the caller's own classes in a month, in the calendar colours, with
 * counts and the attendance %. Only the caller's own records. A class whose check-in has closed
 * with no record shows as Absent (the closing job saves that Absent, SessionClosingService); a
 * paper-register class without its register shows as not recorded; a class on a day of approved
 * leave shows as Leave (P3-06); a cancelled class shows as
 * cancelled and is not counted. A class counts only when its slot existed and, for students, they
 * had joined the section before it started (`countsFor`, the closing job's rule).
 */
@Injectable()
export class MyAttendanceService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    private readonly sessions: ClassSessionsService,
    private readonly checkIns: CheckInService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly leave: ApprovedLeaveService,
    private readonly clock: AttendanceClock,
  ) {}

  async calendar(tenant: Tenant, userId: string, month?: string): Promise<MyCalendarView> {
    const organizationId = tenant.organizationId;
    const now = this.clock.now();
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const today = schoolDateIn(timeZone, now);
    const wanted = month ?? today.slice(0, 7);
    const match = MONTH.exec(wanted);
    if (!match) throw new BadRequestException({ message: 'Choose a month as YYYY-MM', code: ATTENDANCE_ERRORS.CALENDAR_MONTH_INVALID });
    const from = `${wanted}-01`;
    const [year, monthNo] = [Number(match[1]), Number(match[2])];
    const nextMonth = monthNo === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNo + 1).padStart(2, '0')}-01`;
    const to = addDays(nextMonth, -1);

    const mine = await this.checkIns.mySlots(tenant, userId);
    const [closedDays, created, ownRecords, leave] = await Promise.all([
      this.holidays.closedDays(organizationId, from, to),
      this.slots.createdAt(organizationId, mine.map((item) => item.slot.id)),
      this.recordRepo.find({ where: { organization_id: organizationId, person_id: userId, date: Between(from, to) }, relations: ['session'] }),
      this.leave.between(organizationId, from, to, [userId]),
    ]);
    const contexts = await this.sessions.contexts(organizationId, [
      ...mine.map((item) => item.section_id),
      ...ownRecords.map((record) => record.session?.section_id ?? ''),
    ].filter(Boolean));
    const saved = await this.sessions.savedSessions(organizationId, mine.map((item) => item.slot.id), from, to);
    const recordBySession = new Map(ownRecords.map((record) => [record.class_attendance_id, record]));
    const closedOn = new Map(closedDays.map((day) => [day.date, day]));

    const days: CalendarDay[] = [];
    const shown = new Set<string>();
    for (let i = 0; i < daysBetween(from, to); i++) {
      const date = addDays(from, i);
      const closed = closedOn.get(date) ?? null;
      const classes: CalendarClass[] = [];
      for (const item of mine) {
        const context = contexts.get(item.section_id);
        if (!context?.open || item.slot.day_of_week !== isoDayOf(date)) continue;
        const addedOn = created.get(item.slot.id);
        if (addedOn && date < schoolDateIn(timeZone, addedOn)) continue;
        if (item.since && date < schoolDateIn(timeZone, item.since)) continue;
        const session = saved.get(sessionKey(item.slot.id, date));
        const record = session ? (recordBySession.get(session.id) ?? null) : null;
        const window = this.sessions.window(context, item.slot, date, timeZone, session);
        // Added, or joined, after the class had started: it was never theirs (unless they checked in).
        if (!record && !countsFor(window, addedOn, item.since)) continue;
        if (session) shown.add(session.id);
        classes.push({
          slot_id: item.slot.id,
          role: item.role,
          section: sectionOf(context),
          start_time: item.slot.start_time,
          end_time: item.slot.end_time,
          status: statusOf(record, closed, context, checkInState(now, window), session, Boolean(leave.on(userId, date))),
          record: record ? recordView(record) : null,
        });
      }
      // Records of classes that are no longer on the schedule (a removed slot) still show.
      for (const record of ownRecords) {
        if (record.date !== date || shown.has(record.class_attendance_id) || !record.session) continue;
        const context = contexts.get(record.session.section_id);
        if (!context) continue;
        classes.push({
          slot_id: record.session.routine_slot_id,
          role: record.person_type,
          section: sectionOf(context),
          start_time: clockIn(record.session.starts_at, timeZone),
          end_time: clockIn(record.session.ends_at, timeZone),
          status: record.session.status === ClassSessionStatusEnum.CANCELLED ? 'CANCELLED' : record.status,
          record: recordView(record),
        });
      }
      classes.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.section.class_name.localeCompare(b.section.class_name));
      days.push({ date, closed, classes });
    }

    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    for (const item of days.flatMap((day) => day.classes)) {
      if (item.status === 'PRESENT') counts.present++;
      else if (item.status === 'LATE') counts.late++;
      else if (item.status === 'ABSENT') counts.absent++;
      else if (item.status === 'LEAVE') counts.leave++;
    }
    const counted = counts.present + counts.late + counts.absent;
    return {
      month: wanted,
      today,
      time_zone: timeZone,
      days,
      counts,
      attendance_pct: counted === 0 ? null : Math.round(((counts.present + counts.late) / counted) * 100),
    };
  }
}

/**
 * A person's mark for a class (shared with the class view): a cancellation first, then their
 * record, then approved leave (P3-06: Leave before the closing job saves it), then the class's state.
 */
export function statusOf(
  record: AttendanceRecordEntity | null | undefined,
  closed: ClosedDay | null,
  context: SectionContext,
  state: ReturnType<typeof checkInState>,
  session: Pick<ClassSessionEntity, 'status'> | undefined,
  onLeave = false,
): CalendarStatus {
  if (session?.status === ClassSessionStatusEnum.CANCELLED) return 'CANCELLED';
  if (record) return record.status;
  if (closed) return 'CLOSED_DAY';
  if (onLeave) return AttendanceStatusEnum.LEAVE;
  if (state === 'UPCOMING') return 'UPCOMING';
  if (context.mode === SectionAttendanceModeEnum.PAPER_REGISTER) return 'NOT_RECORDED';
  return state === 'OPEN' ? 'OPEN' : AttendanceStatusEnum.ABSENT;
}

const sectionOf = (context: SectionContext) => ({
  id: context.section.id,
  name: context.section.name,
  class_name: context.section.class?.class_name ?? '',
});

/** "HH:MM" of an instant in the time zone. */
const clockIn = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
