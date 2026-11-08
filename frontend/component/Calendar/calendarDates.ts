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

/** Minutes since midnight of an instant on the organisation's clock. */
export const minutesOf = (iso: string, timeZone: string): number => {
  const [h, m] = toZonedParts(iso, timeZone).time.split(":").map(Number);
  return h * 60 + m;
};

/** A timed item placed on a day's hour grid: minutes from midnight, and its column among overlapping items. */
export interface Placed<T> {
  item: T;
  start: number;
  end: number;
  column: number;
  columns: number;
}

/**
 * Lays out one day's timed items as Google Calendar does: items that overlap share the width in
 * columns. Short items (homework due at a time) take at least `min` minutes; an item that runs
 * past midnight ends at midnight.
 */
export const layoutDay = <T extends { starts_at: string; ends_at: string }>(items: T[], timeZone: string, min = 30): Placed<T>[] => {
  const sorted = items
    .map((item) => {
      const start = minutesOf(item.starts_at, timeZone);
      const sameDay = toZonedParts(item.ends_at, timeZone).date === toZonedParts(item.starts_at, timeZone).date;
      const end = sameDay ? minutesOf(item.ends_at, timeZone) : 24 * 60;
      return { item, start, end: Math.min(24 * 60, Math.max(end, start + min)) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const entry of group) entry.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };
  for (const entry of sorted) {
    if (entry.start >= groupEnd) {
      closeGroup();
      groupEnd = -1;
    }
    let column = columnEnds.findIndex((end) => end <= entry.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(entry.end);
    } else columnEnds[column] = entry.end;
    const next = { ...entry, column, columns: 1 };
    group.push(next);
    placed.push(next);
    groupEnd = Math.max(groupEnd, entry.end);
  }
  closeGroup();
  return placed;
};

/** The hours an hour grid shows: 7:00 to 18:00, widened to fit every item. */
export const hourRange = (placed: { start: number; end: number }[]): { first: number; last: number } => ({
  first: Math.min(7, ...placed.map((entry) => Math.floor(entry.start / 60))),
  last: Math.max(18, ...placed.map((entry) => Math.ceil(entry.end / 60))),
});
