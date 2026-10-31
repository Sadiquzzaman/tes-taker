"use client";

import { useLocale } from "next-intl";
import { formatClock, formatDate, formatDateTime, formatFileSize, formatNumber, formatTwoDigits } from "./format";

/** The format helpers bound to the current language, for client components. */
const useFormat = () => {
  const locale = useLocale();

  return {
    locale,
    number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    twoDigits: (value: number) => formatTwoDigits(value, locale),
    fileSize: (bytes: number) => formatFileSize(bytes, locale),
    clock: (totalSeconds: number) => formatClock(totalSeconds, locale),
    date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => formatDate(value, locale, options),
    dateTime: (value: Date | string | number) => formatDateTime(value, locale),
  };
};

export default useFormat;
