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
