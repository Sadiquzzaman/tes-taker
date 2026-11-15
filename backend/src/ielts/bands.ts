/** IELTS bands run 0–9 in half bands. */
export const BANDS: readonly number[] = Array.from({ length: 19 }, (_, i) => i / 2);

export const isBand = (value: unknown): value is number => typeof value === 'number' && BANDS.includes(value);

/** A band table row: a raw score of at least `min_raw` (out of 40) gets `band`. Rows run highest first. */
export interface BandRow {
  min_raw: number;
  band: number;
}

/** The band for a raw Listening / Reading score (out of 40). */
export const bandFromRaw = (rows: readonly BandRow[], raw: number): number => rows.find((row) => raw >= row.min_raw)?.band ?? 0;

/**
 * Rounds to the nearest half band, the IELTS way: .25 goes up to .5 and .75 up to the next
 * whole band (6.125 → 6, 6.25 → 6.5, 6.75 → 7).
 */
export const roundBand = (value: number): number => Math.round(value * 2 + 1e-9) / 2;

/** The overall band: the four module bands averaged and rounded to the nearest half band. */
export const overallBand = (bands: readonly number[]): number => roundBand(bands.reduce((sum, band) => sum + band, 0) / bands.length);

/** The Writing band: Task 1 and Task 2, with Task 2 counting double, rounded to the nearest half band. */
export const writingBand = (task1: number, task2: number): number => roundBand((task1 + 2 * task2) / 3);

/**
 * A table is valid when raw scores are whole numbers 0–40 going down, the last row starts at 0,
 * and bands are 0–9 in half bands and never go up as the raw score goes down.
 */
export const isValidBandTable = (rows: unknown): rows is BandRow[] => {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 41) return false;
  return rows.every((row: Partial<BandRow>, i) => {
    if (!row || typeof row !== 'object' || !Number.isInteger(row.min_raw) || !isBand(row.band)) return false;
    const minRaw = row.min_raw as number;
    if (minRaw < 0 || minRaw > 40) return false;
    if (i === rows.length - 1 && minRaw !== 0) return false;
    const previous = rows[i - 1] as BandRow | undefined;
    return !previous || (minRaw < previous.min_raw && (row.band as number) <= previous.band);
  });
};
