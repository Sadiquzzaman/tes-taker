/**
 * Grading scale checks (FND-11), the same as the API's (backend/src/performance/grading-scale.util.ts)
 * so problems show before saving. The codes match the API's error `code`.
 */
export const MAX_GRADE_BANDS = 20;
export const MAX_GRADE_LENGTH = 5;
export const MAX_GPA = 9.99;

export type GradingScaleErrorCode =
  | "GRADING_SCALE_EMPTY"
  | "GRADING_SCALE_TOO_MANY_BANDS"
  | "GRADING_SCALE_BAND_INVALID"
  | "GRADING_SCALE_MUST_START_AT_0"
  | "GRADING_SCALE_MUST_END_AT_100"
  | "GRADING_SCALE_GAP_OR_OVERLAP"
  | "GRADING_SCALE_DUPLICATE_GRADE";

export const GRADING_SCALE_ERROR_CODES: GradingScaleErrorCode[] = [
  "GRADING_SCALE_EMPTY",
  "GRADING_SCALE_TOO_MANY_BANDS",
  "GRADING_SCALE_BAND_INVALID",
  "GRADING_SCALE_MUST_START_AT_0",
  "GRADING_SCALE_MUST_END_AT_100",
  "GRADING_SCALE_GAP_OR_OVERLAP",
  "GRADING_SCALE_DUPLICATE_GRADE",
];

/** Percentages are compared in hundredths, as integers, so 79.99 + 0.01 is exactly 80. */
const hundredths = (value: number) => Math.round(value * 100);
const twoDecimals = (value: number) => Math.abs(value * 100 - hundredths(value)) < 1e-6;

/** The first problem with the bands (and the row it is on), or null when they can be saved. */
export function validateGradeBands(bands: GradeBand[]): { code: GradingScaleErrorCode; band?: number } | null {
  if (bands.length === 0) return { code: "GRADING_SCALE_EMPTY" };
  if (bands.length > MAX_GRADE_BANDS) return { code: "GRADING_SCALE_TOO_MANY_BANDS" };

  for (const [index, band] of bands.entries()) {
    const grade = band.grade.trim();
    const numbersOk = [band.min_pct, band.max_pct].every((v) => Number.isFinite(v) && v >= 0 && v <= 100 && twoDecimals(v));
    const gpaOk = band.gpa === null || (Number.isFinite(band.gpa) && band.gpa >= 0 && band.gpa <= MAX_GPA && twoDecimals(band.gpa));
    if (!grade || grade.length > MAX_GRADE_LENGTH || !numbersOk || !gpaOk || band.min_pct > band.max_pct) {
      return { code: "GRADING_SCALE_BAND_INVALID", band: index };
    }
  }

  const seen = new Set<string>();
  for (const [index, band] of bands.entries()) {
    const key = band.grade.trim().toLowerCase();
    if (seen.has(key)) return { code: "GRADING_SCALE_DUPLICATE_GRADE", band: index };
    seen.add(key);
  }

  const order = bands.map((band, index) => ({ band, index })).sort((a, b) => a.band.min_pct - b.band.min_pct);
  if (hundredths(order[0].band.min_pct) !== 0) return { code: "GRADING_SCALE_MUST_START_AT_0", band: order[0].index };
  const last = order[order.length - 1];
  if (hundredths(last.band.max_pct) !== 10000) return { code: "GRADING_SCALE_MUST_END_AT_100", band: last.index };
  for (let i = 1; i < order.length; i++) {
    if (hundredths(order[i].band.min_pct) !== hundredths(order[i - 1].band.max_pct) + 1) {
      return { code: "GRADING_SCALE_GAP_OR_OVERLAP", band: order[i].index };
    }
  }
  return null;
}

/** The API's error code when it is a grading scale one (a request saved by someone else meanwhile, etc.). */
export const isGradingScaleErrorCode = (code: unknown): code is GradingScaleErrorCode =>
  typeof code === "string" && (GRADING_SCALE_ERROR_CODES as string[]).includes(code);

/** Marks and percentage as numbers (some endpoints send numeric columns as strings, e.g. "8.00"). */
export const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
