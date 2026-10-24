import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS, type Locale } from "./config";

/** The language saved on this device, if any (browser only). */
export const readLocaleCookie = (): Locale | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : null;
};

/** Saves the language on this device for a year; the server reads it on the next render. */
export const writeLocaleCookie = (locale: Locale) => {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
};

/**
 * After sign-in: the language saved on the account wins over this device's choice.
 * Returns true when the cookie changed. An account without a saved language keeps the device's.
 */
export const applyAccountLocale = (accountLocale: unknown): boolean => {
  if (typeof document === "undefined" || !isLocale(accountLocale) || readLocaleCookie() === accountLocale) {
    return false;
  }
  writeLocaleCookie(accountLocale);
  return true;
};
