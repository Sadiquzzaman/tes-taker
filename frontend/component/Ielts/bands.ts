/** IELTS modules in the order of the real test, and bands 0–9 in half bands. */
export const IELTS_MODULES: IeltsModule[] = ["LISTENING", "READING", "WRITING", "SPEAKING"];
export const BANDS: number[] = Array.from({ length: 19 }, (_, i) => i / 2);

/** Parts per module in the real test: Listening 1–4, Reading passages 1–3, Writing tasks 1–2, Speaking 1–3. */
export const PART_COUNT: Record<IeltsModule, number> = { LISTENING: 4, READING: 3, WRITING: 2, SPEAKING: 3 };
