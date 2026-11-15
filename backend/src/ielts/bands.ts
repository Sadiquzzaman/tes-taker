/** IELTS bands run 0–9 in half bands. */
export const BANDS: readonly number[] = Array.from({ length: 19 }, (_, i) => i / 2);

export const isBand = (value: unknown): value is number => typeof value === 'number' && BANDS.includes(value);
