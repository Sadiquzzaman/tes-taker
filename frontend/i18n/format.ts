import { INTL_LOCALE, TIME_ZONE, type Locale } from "./config";

/**
 * Number and date formatting for the app's languages (FND-18). Bangla uses Bangla digits
 * (০-৯); dates are shown in the organisation's time zone (Asia/Dhaka).
 */
export const formatNumber = (value: number, locale: Locale, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);

/** Pads to two digits, e.g. 7 -> "07" / "০৭". */
export const formatTwoDigits = (value: number, locale: Locale) =>
  formatNumber(value, locale, { minimumIntegerDigits: 2, useGrouping: false });

/** Seconds as MM:SS, e.g. 65 -> "01:05" / "০১:০৫". */
export const formatClock = (totalSeconds: number, locale: Locale) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${formatTwoDigits(Math.floor(seconds / 60), locale)}:${formatTwoDigits(seconds % 60, locale)}`;
};

const SIZE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

/** A file size such as "1.4 MB" / "১.৪ MB" (1 KB = 1024 bytes), for upload sizes and storage use. */
export const formatFileSize = (bytes: number, locale: Locale) => {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return formatNumber(value, locale, {
    style: "unit",
    unit: SIZE_UNITS[unit],
    unitDisplay: "short",
    maximumFractionDigits: unit >= 2 ? 1 : 0,
  });
};

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

/** A date such as "24 Oct 2026" / "২৪ অক্টো, ২০২৬". */
export const formatDate = (
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) => new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TIME_ZONE, ...options }).format(toDate(value));

/** A date with 24-hour time such as "24 Oct 2026, 15:30" / "২৪ অক্টো, ২০২৬, ১৫:৩০". */
export const formatDateTime = (value: Date | string | number, locale: Locale) =>
  formatDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
