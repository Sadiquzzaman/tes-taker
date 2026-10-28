import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import InstructorLogoMarkSVG from "@/component/svg/InstructorLogoMarkSVG";
import { buttonClasses, CheckIcon, cn, focusRing } from "@/design/ui";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import ProductPreview from "./ProductPreview";

/** What the landing page lists under Proctoring. Only checks the exam screen really runs (useProctoring). */
export const PROCTORING_CHECKS = ["browser", "copy", "face", "phone", "disqualify"] as const;
const FEATURES = ["builder", "classes", "grading", "language"] as const;
const SCHOOL_POINTS = ["members", "subjects", "assignments"] as const;

const Section = ({ id, tone = "surface", children }: { id?: string; tone?: "surface" | "canvas"; children: ReactNode }) => (
  <section id={id} className={cn("scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20", tone === "canvas" ? "bg-canvas" : "bg-surface")}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
);

const Heading = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn("font-display text-display text-ink", className)}>{children}</h2>
);

const Tick = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-3 text-body text-ink">
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
      <CheckIcon className="size-3" />
    </span>
    {children}
  </li>
);

export const LandingHero = () => {
  const t = useTranslations("landing.hero");
  return (
    <Section>
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <p className="text-body-sm font-semibold uppercase tracking-wide text-primary">{t("eyebrow")}</p>
          <h1 className="font-display text-display leading-tight text-ink">{t("title")}</h1>
          <p className="max-w-lg text-body text-ink-muted sm:text-title-sm">{t("detail")}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <NextLink href="/signup" className={buttonClasses({ size: "lg" })}>
              {t("start")}
            </NextLink>
            <a href="#pricing" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              {t("plans")}
            </a>
          </div>
        </div>
        <ProductPreview />
      </div>
    </Section>
  );
};

export const LandingFeatures = () => {
  const t = useTranslations("landing.features");
  return (
    <Section id="features" tone="canvas">
      <Heading className="mx-auto mb-12 max-w-2xl text-center">{t("title")}</Heading>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 shadow-card">
            <h3 className="text-title-sm font-semibold text-ink">{t(`${feature}.title`)}</h3>
            <p className="text-body-sm text-ink-muted">{t(`${feature}.detail`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
};

export const LandingProctoring = () => {
  const t = useTranslations("landing.proctoring");
  return (
    <Section id="proctoring">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div className="flex flex-col gap-4">
          <Heading>{t("title")}</Heading>
          <p className="text-body text-ink-muted">{t("detail")}</p>
          <p className="text-body-sm text-ink-muted">{t("planNote")}</p>
        </div>
        <ul className="flex flex-col gap-4 rounded-sheet border border-border bg-canvas p-6">
          {PROCTORING_CHECKS.map((check) => (
            <Tick key={check}>{t(check)}</Tick>
          ))}
        </ul>
      </div>
    </Section>
  );
};

export const LandingForSchools = () => {
  const t = useTranslations("landing.schools");
  return (
    <Section id="schools" tone="canvas">
      <div className="grid gap-10 rounded-sheet bg-ink p-6 text-ink-inverse sm:p-10 md:grid-cols-2 md:items-center">
        <div className="flex flex-col items-start gap-4">
          <p className="text-body-sm font-semibold uppercase tracking-wide text-primary-soft">{t("eyebrow")}</p>
          <h2 className="font-display text-display">{t("title")}</h2>
          <p className="text-body opacity-80">{t("detail")}</p>
          <NextLink href="/signup/organization" className={buttonClasses({ variant: "secondary", size: "lg" })}>
            {t("cta")}
          </NextLink>
        </div>
        <ul className="flex flex-col gap-4">
          {SCHOOL_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-body">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-ink-inverse">
                <CheckIcon className="size-3" />
              </span>
              {t(point)}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
};

export const LandingCallToAction = () => {
  const t = useTranslations("landing.cta");
  return (
    <Section>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <Heading>{t("title")}</Heading>
        <p className="text-body text-ink-muted">{t("detail")}</p>
        <NextLink href="/signup" className={buttonClasses({ size: "lg" })}>
          {t("button")}
        </NextLink>
      </div>
    </Section>
  );
};

export const LandingFooter = () => {
  const t = useTranslations("landing");
  const year = formatNumber(new Date().getFullYear(), useLocale() as Locale, { useGrouping: false });
  return (
    <footer className="border-t border-border bg-surface px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-body-sm text-ink-muted md:flex-row">
        <div className="flex items-center gap-2">
          <InstructorLogoMarkSVG width={24} />
          <span className="font-semibold text-primary">Instructor</span>
        </div>
        <p>{t("footer.rights", { year })}</p>
        <nav aria-label={t("footer.links")} className="flex gap-2">
          <NextLink href="/login" className={cn("flex min-h-11 items-center rounded-input px-2 hover:text-ink", focusRing)}>
            {t("nav.logIn")}
          </NextLink>
          <NextLink href="/signup" className={cn("flex min-h-11 items-center rounded-input px-2 hover:text-ink", focusRing)}>
            {t("nav.signUp")}
          </NextLink>
        </nav>
      </div>
    </footer>
  );
};
