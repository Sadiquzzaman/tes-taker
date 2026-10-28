import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, cn, StatusPill } from "@/design/ui";
import { formatClock, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

const SUBMITTED = 28;
const STUDENTS = 32;
const GRADED = 12;
const QUESTIONS = 10;
const CURRENT = 4;

/**
 * A still picture of the product, built from the app's own components with sample data, so it
 * stays sharp and follows the page language. It is one image for screen readers.
 */
const ProductPreview = () => {
  const t = useTranslations("landing.preview");
  const locale = useLocale() as Locale;
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div role="img" aria-label={t("label")} className="relative mx-auto w-full max-w-md pb-10 sm:pb-6">
      <div aria-hidden="true" className="flex flex-col gap-4 rounded-sheet border border-border bg-canvas p-4 shadow-overlay sm:p-6">
        {/* Teacher: a test waiting to be graded, as on the Grading page. */}
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-card sm:mr-16">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-body font-semibold text-ink">{t("testName")}</p>
              <p className="text-caption text-ink-muted">{t("className")}</p>
            </div>
            <StatusPill tone="warning">{t("needsGrading")}</StatusPill>
          </div>
          {[
            { key: "submitted", label: t("submitted"), done: SUBMITTED, total: STUDENTS },
            { key: "graded", label: t("graded"), done: GRADED, total: SUBMITTED },
          ].map((row) => (
            <div key={row.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-caption">
                <span className="text-ink-muted">{row.label}</span>
                <span className="font-medium text-ink">{`${n(row.done)} / ${n(row.total)}`}</span>
              </div>
              <div className="h-1.5 rounded-full bg-canvas">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((row.done / row.total) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Student: the calm exam screen on a phone. */}
        <div className="-mb-16 ml-auto flex w-56 flex-col gap-3 rounded-sheet border-4 border-ink bg-surface p-3 shadow-overlay sm:-mb-10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-semibold text-ink">{t("timeLeft", { time: formatClock(24 * 60 + 35, locale) })}</span>
            <StatusPill tone="success">{t("monitoring")}</StatusPill>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: QUESTIONS }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index < CURRENT - 1 ? "bg-primary" : index === CURRENT - 1 ? "bg-ink" : "bg-border",
                )}
              />
            ))}
          </div>
          <p className="text-caption text-ink-muted">{t("question", { number: CURRENT, total: QUESTIONS })}</p>
          <p className="text-body-sm font-medium text-ink">{t("prompt")}</p>
          <ul className="flex flex-col gap-1.5">
            {(["optionA", "optionB", "optionC"] as const).map((option, index) => {
              const chosen = index === 0;
              return (
                <li
                  key={option}
                  className={cn(
                    "flex items-center gap-2 rounded-input border px-2.5 py-2 text-caption",
                    chosen ? "border-primary bg-primary-soft text-ink" : "border-border text-ink-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      chosen ? "border-primary bg-primary text-ink-inverse" : "border-ink-muted",
                    )}
                  >
                    {chosen ? <CheckIcon className="size-3" /> : null}
                  </span>
                  {t(option)}
                </li>
              );
            })}
          </ul>
          <span className="self-end rounded-input bg-primary px-3 py-1.5 text-caption font-medium text-ink-inverse">{t("next")}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductPreview;
