import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/lib/store";
import { ToastProvider } from "@/component/Toast/ToastContext";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import { TIME_ZONE, type Locale } from "./config";
import { applyLevelLabels, DEFAULT_LEVEL_LABELS, type LevelLabels } from "./levelLabels";

/** The messages as the app renders them: level tokens replaced by Class / Section (as i18n/request.ts does). */
export const MESSAGES = {
  en: applyLevelLabels(en, DEFAULT_LEVEL_LABELS, "en"),
  bn: applyLevelLabels(bn, DEFAULT_LEVEL_LABELS, "bn"),
} as const;

const messagesFor = (locale: Locale, levelLabels?: LevelLabels) =>
  levelLabels ? applyLevelLabels(locale === "bn" ? bn : en, levelLabels, locale) : MESSAGES[locale];

/** Renders a component inside the translations provider, in English unless a locale is given. */
export const renderWithIntl = (ui: ReactElement, locale: Locale = "en") =>
  render(ui, {
    // A wrapper (not a parent element) so `rerender` keeps the provider.
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone={TIME_ZONE}>
        {children}
      </NextIntlClientProvider>
    ),
  });

/**
 * Renders a screen with everything the app provides around it: translations, a fresh Redux store
 * and toasts, with the workspace's level names (Class / Section unless given). Returns the store so tests can dispatch or read state.
 */
export const renderApp = (
  ui: ReactElement,
  { locale = "en", store = makeStore(), levelLabels }: { locale?: Locale; store?: AppStore; levelLabels?: LevelLabels } = {},
) => ({
  store,
  ...render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={messagesFor(locale, levelLabels)} timeZone={TIME_ZONE}>
        <Provider store={store}>
          <ToastProvider>{children}</ToastProvider>
        </Provider>
      </NextIntlClientProvider>
    ),
  }),
});
