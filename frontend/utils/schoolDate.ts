import { TIME_ZONE } from "@/i18n/config";

/** Today's school date ("YYYY-MM-DD") in the organisation's time zone (design §8.9). */
export const todayInSchool = (now = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** ISO day of the week: 1 = Monday … 7 = Sunday (message keys `attendanceSettings.weekday.N`). */
export type IsoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Week days in the order a Bangladeshi school week runs, Saturday first. */
export const SCHOOL_WEEK: IsoDay[] = [6, 7, 1, 2, 3, 4, 5];

/** The school date `days` after `date` ("YYYY-MM-DD"; negative goes back). */
export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
