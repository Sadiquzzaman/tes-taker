import { toZonedParts } from "@/i18n/zonedTime";
import { addDays, type IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";

export type CalendarView = "month" | "week" | "day";

/** ISO day of a school date: 1 Monday … 7 Sunday. */
export const isoDayOf = (date: string): IsoDay => (((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1) as IsoDay;

/** The Saturday that starts the school week of `date`. */
export const weekStart = (date: string) => addDays(date, -SCHOOL_WEEK.indexOf(isoDayOf(date)));

/** The days a view shows around `date`: a whole month grid (Saturday to Friday), a week, or one day. */
export const rangeOf = (view: CalendarView, date: string): { from: string; to: string } => {
  if (view === "day") return { from: date, to: date };
  if (view === "week") {
    const from = weekStart(date);
    return { from, to: addDays(from, 6) };
  }
  const first = `${date.slice(0, 7)}-01`;
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = addDays(next.toISOString().slice(0, 10), -1);
  return { from: weekStart(first), to: addDays(weekStart(last), 6) };
};

/** The date `view` moves to with the previous (-1) or next (+1) button. */
export const shift = (view: CalendarView, date: string, step: -1 | 1): string => {
  if (view === "day") return addDays(date, step);
  if (view === "week") return addDays(date, 7 * step);
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + step);
  return d.toISOString().slice(0, 10);
};

/** Every date from `from` to `to`. */
export const datesBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date);
  return out;
};

/** The school date an item falls on (its start, in the organisation's time zone). */
export const dateOf = (item: CalendarFeedItem, timeZone: string): string =>
  item.kind === "HOLIDAY" || item.kind === "CLASS" ? item.date : toZonedParts(item.starts_at, timeZone).date;
