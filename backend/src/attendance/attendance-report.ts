import type { CalendarStatus } from './my-attendance.service';

/** Classes counted per mark (ATT-18; monthly summaries count classes). */
export interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  leave: number;
}

export const emptyCounts = (): AttendanceCounts => ({ present: 0, late: 0, absent: 0, leave: 0 });

/** Adds a class's mark (or `times` of them) to the counts; other statuses (upcoming, not recorded, cancelled…) are not counted. */
export function countMark(counts: AttendanceCounts, status: CalendarStatus | null | undefined, times = 1): void {
  if (status === 'PRESENT') counts.present += times;
  else if (status === 'LATE') counts.late += times;
  else if (status === 'ABSENT') counts.absent += times;
  else if (status === 'LEAVE') counts.leave += times;
}

/**
 * The attendance % (ATT-18, ATT-13): (present + late) ÷ (present + late + absent), whole percent;
 * null before any class counts. Leave is not held against anyone. The one place this is worked
 * out: "My attendance", the reports and the Performance read (`studentAttendance`) all use it.
 */
export function attendancePct(counts: Pick<AttendanceCounts, 'present' | 'late' | 'absent'>): number | null {
  const counted = counts.present + counts.late + counts.absent;
  return counted === 0 ? null : Math.round(((counts.present + counts.late) / counted) * 100);
}

/**
 * A person's day in the reports (ATT-13), from their marks in that day's classes:
 * - ABSENT: missed every class held that day (the rule of the guardians' absence SMS, ATT-10);
 * - LATE: at least one late class; PRESENT: at the other classes on time (`missed` says how many
 *   classes they still missed that day);
 * - LEAVE: on leave, attending no class (`missed` counts any Absent beside the leave);
 * - WAITING: nothing to show yet (classes still to come, or a paper register not in yet).
 * Absent "so far" while classes are still to come stays ABSENT with `waiting` > 0.
 * Cancelled classes and closed days are left out; null when no class counts for the person that day.
 */
export type DayStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'WAITING';

export interface DayMark {
  status: DayStatus;
  /** Absent classes on a day that is not ABSENT: attended or on leave for the others (0 for ABSENT days). */
  missed: number;
  /** Classes still to come, open now, or not recorded yet. */
  waiting: number;
}

export function dayMark(statuses: (CalendarStatus | null | undefined)[]): DayMark | null {
  const counts = emptyCounts();
  let waiting = 0;
  let classes = 0;
  for (const status of statuses) {
    if (!status || status === 'CANCELLED' || status === 'CLOSED_DAY') continue;
    classes++;
    if (status === 'UPCOMING' || status === 'OPEN' || status === 'NOT_RECORDED') waiting++;
    else countMark(counts, status);
  }
  if (classes === 0) return null;
  const attended = counts.present + counts.late;
  if (attended > 0) return { status: counts.late > 0 ? 'LATE' : 'PRESENT', missed: counts.absent, waiting };
  if (counts.leave > 0) return { status: 'LEAVE', missed: counts.absent, waiting };
  if (counts.absent > 0) return { status: 'ABSENT', missed: 0, waiting };
  return { status: 'WAITING', missed: 0, waiting };
}
