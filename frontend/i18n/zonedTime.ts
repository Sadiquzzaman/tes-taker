import { TIME_ZONE } from "./config";

/** Minutes the zone is ahead of UTC at that instant (Asia/Dhaka: +360). */
const zoneOffsetMinutes = (instant: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
};

const pad = (value: number) => String(value).padStart(2, "0");

/** An instant as the date ("YYYY-MM-DD") and time ("HH:MM") on the clock in that zone. */
export const toZonedParts = (iso: string | null | undefined, timeZone: string = TIME_ZONE) => {
  if (!iso) return { date: "", time: "" };
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };
  const local = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * 60000);
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
};

/**
 * The UTC instant (ISO string) of a date and time read on the clock in that zone. A missing time
 * means midnight; a missing date gives "".
 */
export const fromZonedParts = (date: string, time: string, timeZone: string = TIME_ZONE) => {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Correct by the zone's offset at that moment (twice, in case the guess crossed a DST change).
  let instant = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60000;
  instant = guess - zoneOffsetMinutes(new Date(instant), timeZone) * 60000;
  return new Date(instant).toISOString();
};
