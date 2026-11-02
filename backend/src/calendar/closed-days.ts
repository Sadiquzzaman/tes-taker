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
}

/** Longest range `closedDaysBetween` works on (a school year and a bit). */
export const MAX_CLOSED_DAYS_RANGE = 400;

/**
 * Every closed day from `from` to `to` (both included, `YYYY-MM-DD`), in date order. Overlapping
 * holidays count once. Attendance (P3-04) skips these days: no Absent, no absence SMS (ATT-10).
 */
export function closedDaysBetween(from: string, to: string, weeklyOffDays: number[], holidays: HolidayRange[]): ClosedDay[] {
  const days = daysBetween(from, to);
  if (days < 1) return [];
  const off = new Set(weeklyOffDays);
  const result: ClosedDay[] = [];
  for (let i = 0; i < Math.min(days, MAX_CLOSED_DAYS_RANGE); i++) {
    const date = addDays(from, i);
    const holiday = holidays.find((h) => h.date_from <= date && h.date_to >= date);
    if (holiday) result.push({ date, reason: 'HOLIDAY', holiday_name: holiday.name });
    else if (off.has(isoDayOf(date))) result.push({ date, reason: 'WEEKLY_OFF' });
  }
  return result;
}
