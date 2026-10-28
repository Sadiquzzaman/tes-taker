"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import LanguageSwitcher from "@/component/Layout/LanguageSwitcher";
import InstructorLogoMarkSVG from "@/component/svg/InstructorLogoMarkSVG";
import { buttonClasses, cn, focusRing, IconButton, MenuIcon, Sheet } from "@/design/ui";

export const LANDING_SECTIONS = ["features", "proctoring", "schools", "pricing"] as const;

const Logo = () => (
  <NextLink href="/" className={cn("flex min-h-11 items-center gap-2 rounded-input", focusRing)}>
    <InstructorLogoMarkSVG width={28} />
    <span className="text-title-sm font-bold text-primary">Instructor</span>
  </NextLink>
);

/** The landing page's top bar: section links on wide screens, a menu sheet on phones. */
const LandingHeader = () => {
  const t = useTranslations("landing.nav");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label={t("label")} className="hidden items-center gap-1 md:flex lg:gap-3">
          {LANDING_SECTIONS.map((section) => (
            <a key={section} href={`#${section}`} className={cn("flex min-h-11 items-center whitespace-nowrap rounded-input px-2 text-body-sm text-ink-muted hover:text-ink", focusRing)}>
              {t(section)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="min-h-11" />
          {/* On phones these two live in the menu sheet. */}
          <div className="hidden items-center gap-2 sm:flex">
            <NextLink href="/login" className={buttonClasses({ variant: "ghost", className: "min-h-11" })}>
              {t("logIn")}
            </NextLink>
            <NextLink href="/signup" className={buttonClasses({ className: "min-h-11" })}>
              {t("signUp")}
            </NextLink>
          </div>
          <IconButton className="min-h-11 min-w-11 md:hidden" variant="ghost" label={t("openMenu")} icon={<MenuIcon className="size-5" />} onClick={() => setMenuOpen(true)} />
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t("menu")}>
        <nav aria-label={t("label")} className="flex flex-col gap-1">
          {LANDING_SECTIONS.map((section) => (
            <a
              key={section}
              href={`#${section}`}
              onClick={() => setMenuOpen(false)}
              className={cn("flex min-h-11 items-center rounded-input px-3 text-body text-ink hover:bg-canvas", focusRing)}
            >
              {t(section)}
            </a>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <NextLink href="/signup" className={buttonClasses({ size: "lg", fullWidth: true })}>
            {t("signUp")}
          </NextLink>
          <NextLink href="/login" className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true })}>
            {t("logIn")}
          </NextLink>
        </div>
      </Sheet>
    </header>
  );
};

export default LandingHeader;
