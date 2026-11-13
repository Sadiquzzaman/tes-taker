/**
 * The score formula (spec Epic 3, "How the score is calculated"; PRF-01, PRF-10). Pure functions,
 * so the rules are tested on their own.
 */

export interface ScoreWeights {
  exams_pct: number;
  homework_pct: number;
  attendance_pct: number;
  behaviour_pct: number;
}

/** A class without its own weights uses the spec's example: exams 50, homework 20, attendance 20, behaviour 10. */
export const DEFAULT_WEIGHTS: ScoreWeights = { exams_pct: 50, homework_pct: 20, attendance_pct: 20, behaviour_pct: 10 };

/** Each part as a percentage (0–100), or null when there is nothing to count yet. */
export interface ScoreParts {
  exams_pct: number | null;
  homework_pct: number | null;
  attendance_pct: number | null;
  behaviour_pct: number | null;
}

const KEYS = ['exams_pct', 'homework_pct', 'attendance_pct', 'behaviour_pct'] as const;

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** The plain average, two decimals; null for none. */
export function mean(values: number[]): number | null {
  return values.length === 0 ? null : round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * The weighted score, two decimals. A part with no data (or weight 0) is left out and the other
 * weights are scaled up to 100%; null when no weighted part has data.
 */
export function weightedScore(parts: ScoreParts, weights: ScoreWeights): number | null {
  let weight = 0;
  let total = 0;
  for (const key of KEYS) {
    const value = parts[key];
    if (value === null || weights[key] <= 0) continue;
    weight += weights[key];
    total += value * weights[key];
  }
  return weight === 0 ? null : round2(total / weight);
}

/** Weights must be whole percent from 0 to 100 that add up to 100. */
export function validWeights(weights: ScoreWeights): boolean {
  return KEYS.every((key) => Number.isInteger(weights[key]) && weights[key] >= 0 && weights[key] <= 100) && KEYS.reduce((sum, key) => sum + weights[key], 0) === 100;
}

/**
 * Merit positions (PRF-10): by score, ties broken by the exams %; still equal, the same position
 * and the next one skipped (1, 2, 2, 4). Students without a score get none.
 */
export function positions(rows: { id: string; score: number | null; exams: number | null }[]): Map<string, number> {
  const ranked = rows.filter((row) => row.score !== null).sort((a, b) => b.score! - a.score! || (b.exams ?? -1) - (a.exams ?? -1));
  const result = new Map<string, number>();
  ranked.forEach((row, index) => {
    const previous = ranked[index - 1];
    const same = previous && previous.score === row.score && (previous.exams ?? -1) === (row.exams ?? -1);
    result.set(row.id, same ? result.get(previous.id)! : index + 1);
  });
  return result;
}
