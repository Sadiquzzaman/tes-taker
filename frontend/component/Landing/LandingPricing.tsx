"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, CheckIcon, cn, EmptyState, Skeleton } from "@/design/ui";
import useGetPlans from "@/hooks/api/subscription/useGetPlans";
import useFormat from "@/i18n/useFormat";

const planName = (plan: SubscriptionPlan) => plan.name ?? plan.display_name ?? "";

/** The plans and their monthly prices, read live from the API so the page never promises stale limits. */
const LandingPricing = () => {
  const t = useTranslations("landing.pricing");
  const format = useFormat();
  const { plans, loading, error } = useGetPlans();
  const visible = plans.filter((plan) => plan.is_plan_active !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const limitLines = (plan: SubscriptionPlan) => {
    const limits = plan.limits ?? {};
    const lines = [
      limits.max_exams_per_month
        ? t("examsPerMonth", { count: limits.max_exams_per_month })
        : limits.max_total_exams
          ? t("examsTotal", { count: limits.max_total_exams })
          : t("unlimited"),
    ];
    if (limits.max_students_per_exam) lines.push(t("students", { count: limits.max_students_per_exam }));
    return lines;
  };

  return (
    <section id="pricing" className="scroll-mt-16 bg-canvas px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <h2 className="font-display text-display text-ink">{t("title")}</h2>
          <p className="text-body text-ink-muted">{t("detail")}</p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-72 rounded-card" />
            ))}
          </div>
        ) : error || visible.length === 0 ? (
          <EmptyState
            title={error ? t("loadFailed") : t("empty")}
            action={
              <NextLink href="/signup" className={buttonClasses({ size: "lg" })}>
                {t("getStarted")}
              </NextLink>
            }
          />
        ) : (
          <ul className={cn("grid gap-4 sm:grid-cols-2", visible.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
            {visible.map((plan) => {
              const price = Number(plan.price_monthly);
              return (
                <li key={plan.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-title-sm font-semibold text-ink">{planName(plan)}</h3>
                    {plan.description ? <p className="text-body-sm text-ink-muted">{plan.description}</p> : null}
                  </div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-title font-semibold text-primary">{price > 0 ? `৳${format.number(price)}` : t("free")}</span>
                    {price > 0 ? <span className="text-body-sm text-ink-muted">{t("perMonth")}</span> : null}
                  </p>
                  <ul className="flex flex-1 flex-col gap-2 text-body-sm text-ink">
                    {limitLines(plan).map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <CheckIcon className="mt-0.5 text-primary" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <NextLink href="/signup" className={buttonClasses({ variant: price > 0 ? "primary" : "secondary", fullWidth: true, size: "lg" })}>
                    {price > 0 ? t("choose", { plan: planName(plan) }) : t("getStarted")}
                  </NextLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default LandingPricing;
