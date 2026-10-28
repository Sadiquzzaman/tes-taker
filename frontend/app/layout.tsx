import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/component/Toast/ToastContext";
import StoreProvider from "./StoreProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Instructor — Secure Online Exams for Educators",
  description:
    "Create, proctor, and grade online exams with Instructor. Free plan available. AI-powered proctoring scales with your subscription.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* One request for every UI font: Instrument Sans (Latin), Hind Siliguri (Bangla; design
            tokens' font-sans falls back to it), DM Serif Display (marketing headings, font-display). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Hind+Siliguri:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider>
          <StoreProvider>
            <ToastProvider>{children}</ToastProvider>
          </StoreProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
