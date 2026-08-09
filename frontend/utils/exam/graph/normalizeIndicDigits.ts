/** Map Bangla (and common Indic) digits to ASCII so Number() / parsers work. */
const INDIC_DIGIT_MAP: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

export const normalizeIndicDigits = (value: string): string =>
  value.replace(/[০-৯٠-٩]/g, (char) => INDIC_DIGIT_MAP[char] ?? char);

export const parseLocaleNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") {
    return value;
  }
  if (value == null || value === "") {
    return Number.NaN;
  }
  const normalized = normalizeIndicDigits(String(value)).replace(/,/g, "").trim();
  return Number(normalized);
};
