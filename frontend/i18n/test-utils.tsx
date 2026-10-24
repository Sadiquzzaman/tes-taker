import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import { TIME_ZONE, type Locale } from "./config";

export const MESSAGES = { en, bn } as const;

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
