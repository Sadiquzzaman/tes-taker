/** How a test's length is written: "45 min", "2 h" or "1 h 30 min" (keys under dashboard.duration). */
export function durationMessage(
  minutes: number | null,
): { key: "minutes" | "hours" | "hoursMinutes"; values: { hours: number; minutes: number } } | null {
  if (!minutes) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return { key: "minutes", values: { hours, minutes: rest } };
  if (rest === 0) return { key: "hours", values: { hours, minutes: rest } };
  return { key: "hoursMinutes", values: { hours, minutes: rest } };
}
