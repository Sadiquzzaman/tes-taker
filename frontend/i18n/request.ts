import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, TIME_ZONE } from "./config";
import { applyLevelLabels, LEVEL_LABELS_COOKIE, parseLevelLabelsCookie } from "./levelLabels";

/**
 * Picks the language for each request from the cookie (no language in the URL), and names the
 * academic levels the way the current workspace does (FND-03, `level_labels` cookie).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const levelLabels = parseLevelLabelsCookie(cookieStore.get(LEVEL_LABELS_COOKIE)?.value);

  return {
    locale,
    timeZone: TIME_ZONE,
    messages: applyLevelLabels((await import(`../messages/${locale}.json`)).default, levelLabels, locale),
  };
});
