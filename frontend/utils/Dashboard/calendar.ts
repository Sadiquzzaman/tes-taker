import { INTL_LOCALE, TIME_ZONE, type Locale } from "@/i18n/config";

/** Short weekday names starting on Sunday, in the page language ("Sun" / "রবি"). */
export function weekDayNames(locale: Locale): string[] {
  // 4 Jan 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 0, 4 + index)),
    ),
  );
}

/** "October 2026" / "অক্টোবর ২০২৬". */
export function monthTitle(month: number, year: number, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** Today's day, month and year in the organisation's time zone. */
export function todayInTimeZone(now: Date = new Date()): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return { day: part("day"), month: part("month"), year: part("year") };
}

/**
 * The days shown for a month, in weeks of 7 starting on Sunday. Days outside the month are null,
 * so only the month's own days are drawn.
 */
export function monthGrid(month: number, year: number): Array<Array<number | null>> {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = getDaysInMonth(month, year);
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
