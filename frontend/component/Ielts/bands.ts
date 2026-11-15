/** IELTS modules in the order of the real test, and bands 0–9 in half bands. */
export const IELTS_MODULES: IeltsModule[] = ["LISTENING", "READING", "WRITING", "SPEAKING"];
export const BANDS: number[] = Array.from({ length: 19 }, (_, i) => i / 2);
