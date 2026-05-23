export const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function getMonthName(monthNumber: number, year: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, monthNumber - 1));
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function getPrevMonthYear(month: number, year: number): { month: number; year: number } {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

export const sampleTestDates: SampleTestDate[] = [
  { year: 2026, month: 3, day: 4, tests: 2 },
  { year: 2026, month: 3, day: 7, tests: 1 },
  { year: 2026, month: 3, day: 12, tests: 3 },
  { year: 2026, month: 3, day: 18, tests: 1 },
  { year: 2026, month: 3, day: 25, tests: 2 },
  { year: 2026, month: 4, day: 3, tests: 1 },
  { year: 2026, month: 4, day: 15, tests: 4 },
];

export function hasTest(day: number, month: number, year: number): boolean {
  return sampleTestDates.some((t) => t.day === day && t.month === month && t.year === year);
}
