import { addDays, daysBetween, isoDayOf } from 'src/common/utils/school-date.util';

/** A day the organisation is closed: a weekly off day (attendance settings) or a holiday (CAL-04). */
export interface ClosedDay {
  date: string;
  reason: 'WEEKLY_OFF' | 'HOLIDAY';
  /** The holiday's note, when it is a holiday (a holiday on an off day counts as the holiday). */
  holiday_name?: string | null;
}

export interface HolidayRange {
  date_from: string;
  date_to: string;
  name: string | null;
  /** The organisation's date the holiday was removed, for a removed one; it still closes the days up to then. */
  removed_on?: string | null;
}

/** Earlier weekly off days and the last date (organisation's time zone) they applied to. */
export interface WeeklyOffDaysChange {
  days: number[];
  until: string;
}

/** Longest range `closedDaysBetween` works on (a school year and a bit). */
export const MAX_CLOSED_DAYS_RANGE = 400;

/**
 * Every closed day from `from` to `to` (both included, `YYYY-MM-DD`), in date order. Overlapping
 * holidays count once. Attendance (P3-04) skips these days: no Absent, no absence SMS (ATT-10).
 *
 * Closing a day applies at once, also to days already past. Opening one never reaches back: a day
 * that was a weekly off day on its own date (`history`), or a holiday removed on or after it
 * (`removed_on`), stays closed, so the closing job's catch-up cannot turn it into Absent.
 */
export function closedDaysBetween(
  from: string,
  to: string,
  weeklyOffDays: number[],
  holidays: HolidayRange[],
  history: WeeklyOffDaysChange[] = [],
): ClosedDay[] {
  const days = daysBetween(from, to);
  if (days < 1) return [];
  const off = new Set(weeklyOffDays);
  const earlier = [...history].sort((a, b) => a.until.localeCompare(b.until));
  const result: ClosedDay[] = [];
  for (let i = 0; i < Math.min(days, MAX_CLOSED_DAYS_RANGE); i++) {
    const date = addDays(from, i);
    const holiday = holidays.find((h) => h.date_from <= date && h.date_to >= date && (!h.removed_on || h.removed_on >= date));
    const day = isoDayOf(date);
    // Off on that date under an earlier setting: each one applied from the previous change's date
    // to its own `until`, both included (on a change date both the old and the new one applied).
    const offThen = earlier.some((change, j) => change.until >= date && (j === 0 || earlier[j - 1].until <= date) && change.days.includes(day));
    if (holiday) result.push({ date, reason: 'HOLIDAY', holiday_name: holiday.name });
    else if (off.has(day) || offThen) result.push({ date, reason: 'WEEKLY_OFF' });
  }
  return result;
}
