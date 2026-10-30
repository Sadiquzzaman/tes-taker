/** One band of a grading scale: a percentage range (inclusive, two decimals) and its grade. */
export interface GradeBand {
  min_pct: number;
  max_pct: number;
  grade: string;
  gpa: number | null;
}

/** The grade a percentage gets on a scale. */
export interface Grade {
  grade: string;
  gpa: number | null;
}

export const MAX_GRADE_BANDS = 20;
export const MAX_GRADE_LENGTH = 5;
export const MAX_GPA = 9.99;

/** The platform default scale's name. */
export const BANGLADESH_NATIONAL_NAME = 'Bangladesh national';

/**
 * Bangladesh national grading (FND-11), highest first. The migration seeds it as the platform
 * default row; the code falls back to it if that row is missing.
 */
export const BANGLADESH_NATIONAL_BANDS: GradeBand[] = [
  { min_pct: 80, max_pct: 100, grade: 'A+', gpa: 5 },
  { min_pct: 70, max_pct: 79.99, grade: 'A', gpa: 4 },
  { min_pct: 60, max_pct: 69.99, grade: 'A-', gpa: 3.5 },
  { min_pct: 50, max_pct: 59.99, grade: 'B', gpa: 3 },
  { min_pct: 40, max_pct: 49.99, grade: 'C', gpa: 2 },
  { min_pct: 33, max_pct: 39.99, grade: 'D', gpa: 1 },
  { min_pct: 0, max_pct: 32.99, grade: 'F', gpa: 0 },
];

/**
 * Why a set of bands cannot be saved. The web client runs the same checks
 * (frontend/utils/gradingScale.ts) and translates these codes.
 */
export const GRADING_SCALE_ERRORS = {
  EMPTY: 'GRADING_SCALE_EMPTY',
  TOO_MANY: 'GRADING_SCALE_TOO_MANY_BANDS',
  BAND_INVALID: 'GRADING_SCALE_BAND_INVALID',
  START: 'GRADING_SCALE_MUST_START_AT_0',
  END: 'GRADING_SCALE_MUST_END_AT_100',
  GAP_OR_OVERLAP: 'GRADING_SCALE_GAP_OR_OVERLAP',
  DUPLICATE_GRADE: 'GRADING_SCALE_DUPLICATE_GRADE',
} as const;

export type GradingScaleErrorCode = (typeof GRADING_SCALE_ERRORS)[keyof typeof GRADING_SCALE_ERRORS];

/** Percentages are compared in hundredths, as integers, so 79.99 + 0.01 is exactly 80. */
const hundredths = (value: number): number => Math.round(value * 100);

const hasAtMostTwoDecimals = (value: number): boolean => Math.abs(value * 100 - hundredths(value)) < 1e-6;

/**
 * The grade for a percentage (marks obtained ÷ total × 100). The percentage is rounded to two
 * decimals and kept within 0–100 (negative marking, bonus marks), so a valid scale always answers.
 */
export function gradeForPercentage(bands: GradeBand[], percentage: number | null | undefined): Grade | null {
  if (percentage === null || percentage === undefined || !Number.isFinite(percentage)) return null;
  const value = Math.min(10000, Math.max(0, hundredths(percentage)));
  const band = bands.find((b) => hundredths(b.min_pct) <= value && value <= hundredths(b.max_pct));
  return band ? { grade: band.grade, gpa: band.gpa } : null;
}

/**
 * Checks that the bands cover 0–100% exactly once, in steps of 0.01, with distinct grades.
 * Returns the first problem found (with the band's position as given), or null when valid.
 */
export function validateGradeBands(bands: GradeBand[]): { code: GradingScaleErrorCode; band?: number } | null {
  if (bands.length === 0) return { code: GRADING_SCALE_ERRORS.EMPTY };
  if (bands.length > MAX_GRADE_BANDS) return { code: GRADING_SCALE_ERRORS.TOO_MANY };

  for (const [index, band] of bands.entries()) {
    const grade = band.grade?.trim() ?? '';
    const numbersOk = [band.min_pct, band.max_pct].every((v) => Number.isFinite(v) && v >= 0 && v <= 100 && hasAtMostTwoDecimals(v));
    const gpaOk = band.gpa === null || (Number.isFinite(band.gpa) && band.gpa >= 0 && band.gpa <= MAX_GPA && hasAtMostTwoDecimals(band.gpa));
    if (!grade || grade.length > MAX_GRADE_LENGTH || !numbersOk || !gpaOk || band.min_pct > band.max_pct) {
      return { code: GRADING_SCALE_ERRORS.BAND_INVALID, band: index };
    }
  }

  const seen = new Map<string, number>();
  for (const [index, band] of bands.entries()) {
    const key = band.grade.trim().toLowerCase();
    if (seen.has(key)) return { code: GRADING_SCALE_ERRORS.DUPLICATE_GRADE, band: index };
    seen.set(key, index);
  }

  const order = bands.map((band, index) => ({ band, index })).sort((a, b) => a.band.min_pct - b.band.min_pct);
  if (hundredths(order[0].band.min_pct) !== 0) return { code: GRADING_SCALE_ERRORS.START, band: order[0].index };
  const last = order[order.length - 1];
  if (hundredths(last.band.max_pct) !== 10000) return { code: GRADING_SCALE_ERRORS.END, band: last.index };
  for (let i = 1; i < order.length; i++) {
    if (hundredths(order[i].band.min_pct) !== hundredths(order[i - 1].band.max_pct) + 1) {
      return { code: GRADING_SCALE_ERRORS.GAP_OR_OVERLAP, band: order[i].index };
    }
  }
  return null;
}

/** The bands highest first, with the grade trimmed — how they are stored and returned. */
export function normalizeGradeBands(bands: GradeBand[]): GradeBand[] {
  return [...bands]
    .sort((a, b) => b.min_pct - a.min_pct)
    .map((band) => ({ min_pct: band.min_pct, max_pct: band.max_pct, grade: band.grade.trim(), gpa: band.gpa ?? null }));
}
