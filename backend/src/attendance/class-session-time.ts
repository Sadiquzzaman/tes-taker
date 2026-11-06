/**
 * Times and distances of class sessions (ATT-04, ATT-06). Schedules are wall-clock times in the
 * organisation's time zone; a session on a date becomes real instants here. No package needed:
 * the zone offset comes from Intl.
 */

/** Check-in opens this many minutes before the scheduled start (ATT-04). */
export const CHECKIN_OPENS_BEFORE_MINUTES = 15;
/** Worst GPS accuracy accepted for an in-person check-in, in metres (ATT-04). */
export const MAX_ACCURACY_M = 100;
/** Accuracy worse than this, with the reported circle reaching outside the radius, flags the check-in. */
export const EDGE_ACCURACY_M = 50;
/** Faster than this between two in-person check-ins of one person is an impossible jump. */
export const MAX_TRAVEL_KMH = 100;
/** Jumps shorter than this are GPS noise, not a flag. */
export const MIN_JUMP_M = 2000;
/** Only check-ins this close in time are compared for jumps. */
export const JUMP_WINDOW_HOURS = 12;

/** A session's instants: check-in opens, the class starts, Late begins after, check-in closes (the end). */
export interface SessionWindow {
  opens_at: Date;
  starts_at: Date;
  late_after: Date;
  ends_at: Date;
}

export type CheckInState = 'UPCOMING' | 'OPEN' | 'CLOSED';

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

/** The check-in window of a slot on a date; Late after start + `graceMinutes`. */
export function sessionWindow(date: string, startTime: string, endTime: string, timeZone: string, graceMinutes: number): SessionWindow {
  const starts_at = zonedInstant(date, startTime, timeZone);
  return {
    opens_at: new Date(starts_at.getTime() - CHECKIN_OPENS_BEFORE_MINUTES * 60_000),
    starts_at,
    late_after: new Date(starts_at.getTime() + graceMinutes * 60_000),
    ends_at: zonedInstant(date, endTime, timeZone),
  };
}

/**
 * Whether a class counts for a person (ATT-10, ATT-18): its weekly slot existed, and the student
 * had joined the section, before the class started. Otherwise a missing check-in is not an Absent
 * (a slot added during the class, or a student who joined after it began).
 */
export function countsFor(window: Pick<SessionWindow, 'starts_at'>, slotAddedAt?: Date | null, since?: Date | null): boolean {
  if (slotAddedAt && slotAddedAt >= window.starts_at) return false;
  return !since || since < window.starts_at;
}

/** Before the window, inside it (opens_at ≤ now < ends_at), or after it. */
export function checkInState(now: Date, window: Pick<SessionWindow, 'opens_at' | 'ends_at'>): CheckInState {
  if (now < window.opens_at) return 'UPCOMING';
  return now < window.ends_at ? 'OPEN' : 'CLOSED';
}

/**
 * On time until start + grace (inclusive); Late after that, with the whole minutes since the start
 * (ATT-06: "arrived late at 9:24" for a 9:00 class is 24 minutes late).
 */
export function lateness(now: Date, window: Pick<SessionWindow, 'starts_at' | 'late_after'>): { late: boolean; minutes: number | null } {
  if (now <= window.late_after) return { late: false, minutes: null };
  return { late: true, minutes: Math.floor((now.getTime() - window.starts_at.getTime()) / 60_000) };
}

/** Great-circle distance in metres. */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Poor accuracy at the edge: accuracy worse than 50 m and the reported circle reaches outside the radius. */
export function isEdgeAccuracy(distanceM: number, accuracyM: number, radiusM: number): boolean {
  return accuracyM > EDGE_ACCURACY_M && distanceM + accuracyM > radiusM;
}

/** Whether moving `metres` in `ms` is faster than anyone travels in a city (and far enough not to be GPS noise). */
export function isImpossibleJump(metres: number, ms: number): boolean {
  if (metres < MIN_JUMP_M) return false;
  const hours = Math.max(ms, 60_000) / 3_600_000;
  return metres / 1000 / hours > MAX_TRAVEL_KMH;
}
