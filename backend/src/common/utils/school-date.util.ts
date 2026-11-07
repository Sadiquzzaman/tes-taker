/**
 * School days are `date` values in the organisation's time zone (design §8.9). These helpers work on
 * `YYYY-MM-DD` strings so no Date ever shifts a day through the server's own time zone.
 */

const DEFAULT_TIME_ZONE = 'Asia/Dhaka';

/** Today's school date (`YYYY-MM-DD`) in a time zone; an unknown zone falls back to Asia/Dhaka. */
export function schoolDateIn(timeZone: string | null | undefined, now = new Date()): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return format(timeZone || DEFAULT_TIME_ZONE);
  } catch {
    return format(DEFAULT_TIME_ZONE);
  }
}

/** ISO day of the week for a school date: 1 = Monday … 7 = Sunday. */
export function isoDayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The date `days` after (or before, if negative) a school date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included (1 for a single day). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** A real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30). */
export function isSchoolDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (Dhaka: +6 h). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant of wall-clock `time` ("HH:MM") on school `date` ("YYYY-MM-DD") in `timeZone`. */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall - zoneOffsetMs(new Date(wall), timeZone);
  // A second pass settles days when the offset changes (daylight saving zones).
  instant = wall - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}
