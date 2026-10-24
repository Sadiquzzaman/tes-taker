"use client";

import { AxiosError } from "axios";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge, Button, Card, cn, EmptyState, ErrorState, RadioGroup, Skeleton } from "@/design/ui";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useGetPlans from "@/hooks/api/subscription/useGetPlans";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const CYCLES: BillingCycle[] = ["MONTHLY", "HALF_YEARLY", "YEARLY"];

export const getPrice = (plan: SubscriptionPlan, cycle: BillingCycle) => {
  if (cycle === "MONTHLY") return Number(plan.price_monthly);
  if (cycle === "HALF_YEARLY") return Number(plan.price_half_yearly);
  return Number(plan.price_yearly);
};

/** Whether a plan can be bought from here: the current plan and lower ones cannot. */
export const getPlanState = (plan: SubscriptionPlan, currentSortOrder: number, currentSlug?: string) => {
  if (plan.slug === currentSlug) return "current" as const;
  if ((plan.sort_order ?? 0) <= currentSortOrder) return "downgrade" as const;
  return "upgrade" as const;
};

/** The teacher's plan and usage, and the paid plans they can upgrade to. */
const AccountBilling = () => {
  const t = useTranslations("billing");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { entitlements, loading: entitlementsLoading, error, refetch } = useEntitlements();
  const { plans, loading: plansLoading } = useGetPlans();
  const { handleError } = useApiError();
  const highlightSlug = useSearchParams().get("plan");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const currentSlug = entitlements?.plan?.slug;
  const currentSortOrder = plans.find((plan) => plan.slug === currentSlug)?.sort_order ?? 0;

  useEffect(() => {
    if (!highlightSlug || plansLoading) return;
    document.getElementById(`plan-${highlightSlug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSlug, plansLoading]);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    // Free plans have nothing to pay for; the displayed price is never sent to the server.
    if (!getPrice(plan, billingCycle)) return;
    setCheckoutLoading(plan.id);
    try {
      const subscribeRes = await axiosReq.post(`${baseUrl}/subscriptions/subscribe`, {
        plan_id: plan.id,
        billing_cycle: billingCycle,
      });
      const subscription = subscribeRes.data?.payload;
      if (!subscription?.id) throw new Error("No subscription returned");

      // The server reads the price from the pending subscription; never send an amount.
      const paymentRes = await axiosReq.post(`${baseUrl}/payments/initiate`, { subscriptionId: subscription.id });
      const gatewayUrl = paymentRes.data?.payload?.gatewayPageUrl ?? paymentRes.data?.gatewayPageUrl;
      if (gatewayUrl) {
        window.location.href = gatewayUrl;
        return;
      }
      throw new Error("No gateway URL returned");
    } catch (checkoutError) {
      handleError(checkoutError as AxiosError<ApiError>);
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (entitlementsLoading) {
    return (
      <Card title={t("title")} aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={t("title")}>
        <ErrorState title={t("loadFailed")} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const usage = entitlements?.usage;
  const usageText = (used: number, limit?: number) => (limit ? t("usageOf", { used, limit }) : format.number(used));
  const paidPlans = plans
    .filter((plan) => getPrice(plan, billingCycle) > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <Card
      title={t("title")}
      description={t.rich("currentPlan", {
        plan: entitlements?.plan?.name ?? t("free"),
        b: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
      })}
      actions={
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          {t("refresh")}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {usage ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-input bg-canvas p-3">
              <dt className="text-body-sm text-ink-muted">{t("examsThisMonth")}</dt>
              <dd className="text-body font-semibold text-ink">
                {usageText(usage.exams_used_this_month, entitlements?.limits?.max_exams_per_month)}
              </dd>
            </div>
            <div className="rounded-input bg-canvas p-3">
              <dt className="text-body-sm text-ink-muted">{t("totalExams")}</dt>
              <dd className="text-body font-semibold text-ink">{usageText(usage.total_exams_used, entitlements?.limits?.max_total_exams)}</dd>
            </div>
          </dl>
        ) : null}

        <RadioGroup
          inline
          legend={t("cycle")}
          name="billing-cycle"
          value={billingCycle}
          onChange={(value) => setBillingCycle(value as BillingCycle)}
          options={CYCLES.map((cycle) => ({ value: cycle, label: t(`cycles.${cycle}`) }))}
        />

        {plansLoading ? (
          <Skeleton lines={3} />
        ) : !paidPlans.length ? (
          <EmptyState title={t("noPlans")} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {paidPlans.map((plan) => {
              const state = getPlanState(plan, currentSortOrder, currentSlug);
              const highlighted = Boolean(highlightSlug) && plan.slug === highlightSlug;
              return (
                <li
                  key={plan.id}
                  id={`plan-${plan.slug}`}
                  className={cn(
                    "flex flex-col gap-3 rounded-card border p-4",
                    highlighted ? "border-primary ring-2 ring-primary" : state === "current" ? "border-primary" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body font-semibold text-ink">{plan.name ?? plan.display_name}</p>
                    {state === "current" ? <Badge tone="primary">{t("current")}</Badge> : null}
                  </div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-title font-semibold text-ink">৳{format.number(getPrice(plan, billingCycle))}</span>
                    <span className="text-body-sm text-ink-muted">{t(`per.${billingCycle}`)}</span>
                  </p>
                  {plan.description ? <p className="text-body-sm text-ink-muted">{plan.description}</p> : null}
                  {state === "upgrade" ? (
                    <Button loading={checkoutLoading === plan.id} disabled={Boolean(checkoutLoading)} onClick={() => void handleCheckout(plan)}>
                      {t("upgrade")}
                    </Button>
                  ) : state === "downgrade" ? (
                    <p className="text-body-sm text-ink-muted">{t("downgradeHint")}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default AccountBilling;
