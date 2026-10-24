/**
 * Languages (FND-18). The app's own codes are `en` and `bn` (also stored in users.locale);
 * Intl formatting uses Bangladesh conventions for each.
 */
export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];

/** Visitors see English until they choose (owner's decision). */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that holds the chosen language (readable by the server for the first render). */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Dates and times are shown in Bangladesh time (design §8.9). */
export const TIME_ZONE = "Asia/Dhaka";

/** Intl locale per app language: day-month-year English, Bangla digits for Bangla. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  bn: "bn-BD",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);
