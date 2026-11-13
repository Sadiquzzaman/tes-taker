import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, TIME_ZONE } from "@/i18n/config";
import { applyLevelLabels, LEVEL_LABELS_COOKIE, parseLevelLabelsCookie } from "@/i18n/levelLabels";

/**
 * Prints report cards in the card's language (`locale`), whatever language the app is in: loads
 * that language's card texts (and the shared UI texts) on the server, with the workspace's level
 * names, as i18n/request.ts does for the whole app.
 */
const CardLocaleProvider = async ({ locale, children }: { locale?: string; children: ReactNode }) => {
  const cookieStore = await cookies();
  const appLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const chosen = isLocale(locale) ? locale : isLocale(appLocale) ? appLocale : DEFAULT_LOCALE;
  const levelLabels = parseLevelLabelsCookie(cookieStore.get(LEVEL_LABELS_COOKIE)?.value);
  const messages = applyLevelLabels((await import(`../../messages/${chosen}.json`)).default, levelLabels, chosen);
  return (
    <NextIntlClientProvider locale={chosen} timeZone={TIME_ZONE} messages={{ reportCard: messages.reportCard, ui: messages.ui }}>
      {children}
    </NextIntlClientProvider>
  );
};

export default CardLocaleProvider;
