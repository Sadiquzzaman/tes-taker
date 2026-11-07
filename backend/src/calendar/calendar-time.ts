import { zonedInstant } from 'src/common/utils/school-date.util';

/** The first instant of a school date ("YYYY-MM-DD") in the organisation's time zone. */
export const zonedDayStart = (date: string, timeZone: string): Date => zonedInstant(date, '00:00', timeZone);
