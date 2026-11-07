import { HomeworkSettings } from 'src/organizations/org-settings.service';

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The late penalty for a score (HW-04, Epic 2 settings): none when on time or the organisation has
 * none; `percent` off per started day late (PER_DAY, at most 100 %), or `percent` off once (FIXED).
 * Returns the marks taken off and the final score (never below 0), to two decimals.
 */
export function lateScore(
  raw: number,
  penalty: HomeworkSettings['late_penalty'],
  lateMinutes: number | null,
): { penalty: number; final: number } {
  if (!lateMinutes || lateMinutes <= 0 || penalty.type === 'NONE' || penalty.percent <= 0) return { penalty: 0, final: round2(raw) };
  const days = Math.ceil(lateMinutes / (24 * 60));
  const percent = penalty.type === 'PER_DAY' ? Math.min(100, penalty.percent * days) : Math.min(100, penalty.percent);
  const off = round2((raw * percent) / 100);
  return { penalty: off, final: round2(Math.max(0, raw - off)) };
}
