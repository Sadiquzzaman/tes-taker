"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useGetPlans from "@/hooks/api/subscription/useGetPlans";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";

type BillingCycle = "MONTHLY" | "HALF_YEARLY" | "YEARLY";

const cycleLabels: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
};

const getPrice = (plan: SubscriptionPlan, cycle: BillingCycle) => {
  if (cycle === "MONTHLY") return Number(plan.price_monthly);
  if (cycle === "HALF_YEARLY") return Number(plan.price_half_yearly);
  return Number(plan.price_yearly);
};

const getPlanButtonState = (
  plan: SubscriptionPlan,
  currentSortOrder: number,
  currentSlug?: string,
) => {
  const planSortOrder = plan.sort_order ?? 0;

  if (plan.slug === currentSlug) {
    return { disabled: true, label: "Current plan" };
  }

  if (planSortOrder <= currentSortOrder) {
    return { disabled: true, label: "Downgrade unavailable" };
  }

  return { disabled: false, label: "Upgrade" };
};

const AccountBilling = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { entitlements, loading: entitlementsLoading, refetch } = useEntitlements();
  const { plans, loading: plansLoading } = useGetPlans();
  const { handleError } = useApiError();
  const searchParams = useSearchParams();
  const highlightSlug = searchParams.get("plan");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.slug === entitlements?.plan?.slug),
    [plans, entitlements?.plan?.slug],
  );
  const currentSortOrder = currentPlan?.sort_order ?? 0;

  useEffect(() => {
    if (!highlightSlug || plansLoading) return;
    const el = document.getElementById(`plan-${highlightSlug}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSlug, plansLoading]);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    const amount = getPrice(plan, billingCycle);
    if (!amount) return;

    setCheckoutLoading(plan.id);

    try {
      const subscribeRes = await axiosReq.post(`${baseUrl}/subscriptions/subscribe`, {
        plan_id: plan.id,
        billing_cycle: billingCycle,
      });

      const subscription = subscribeRes.data?.payload;
      const user = JSON.parse(localStorage.getItem("user") ?? "{}");

      const paymentRes = await axiosReq.post(`${baseUrl}/payments/initiate`, {
        orderId: `SUB_${subscription?.id ?? plan.id}_${Date.now()}`,
        amount,
        customer: {
          name: user.full_name ?? "Teacher",
          email: user.email ?? "teacher@instructor.academy",
          phone: user.phone ?? "01700000000",
        },
        productName: `${plan.name ?? plan.display_name} Subscription`,
        productCategory: "subscription",
        teacherId: user.id,
        planId: plan.id,
        billingCycle,
        subscriptionId: subscription?.id,
      });

      const gatewayUrl = paymentRes.data?.payload?.gatewayPageUrl ?? paymentRes.data?.gatewayPageUrl;
      if (gatewayUrl) {
        window.location.href = gatewayUrl;
        return;
      }

      throw new Error("No gateway URL returned");
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (entitlementsLoading) {
    return <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 animate-pulse h-40" />;
  }

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[20px] font-[600] text-[#232A25]">Billing & plan</p>
          <p className="text-sm text-[#747775]">
            Current plan: <strong>{entitlements?.plan?.name ?? "Free"}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm text-[#49734F] hover:underline"
        >
          Refresh usage
        </button>
      </div>

      {entitlements?.usage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#747775]">
          <div className="rounded-[8px] bg-[#EFF0F3] p-3">
            Exams this month: {entitlements.usage.exams_used_this_month}
            {entitlements.limits?.max_exams_per_month
              ? ` / ${entitlements.limits.max_exams_per_month}`
              : ""}
          </div>
          <div className="rounded-[8px] bg-[#EFF0F3] p-3">
            Total exams used: {entitlements.usage.total_exams_used}
            {entitlements.limits?.max_total_exams ? ` / ${entitlements.limits.max_total_exams}` : ""}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(cycleLabels) as BillingCycle[]).map((cycle) => (
          <button
            key={cycle}
            type="button"
            onClick={() => setBillingCycle(cycle)}
            className={`px-3 py-1.5 rounded-[6px] text-sm ${
              billingCycle === cycle ? "bg-[#49734F] text-white" : "bg-[#EFF0F3] text-[#232A25]"
            }`}
          >
            {cycleLabels[cycle]}
          </button>
        ))}
      </div>

      {!plansLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plans
            .filter((plan) => getPrice(plan, billingCycle) > 0)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((plan) => {
              const buttonState = getPlanButtonState(plan, currentSortOrder, entitlements?.plan?.slug);
              const isDisabled = buttonState.disabled || checkoutLoading === plan.id;

              return (
                <div
                  key={plan.id}
                  id={`plan-${plan.slug}`}
                  className={`border rounded-[8px] p-4 flex flex-col gap-3 ${
                    highlightSlug && plan.slug === highlightSlug
                      ? "border-[#49734F] ring-2 ring-[#49734F]"
                      : plan.slug === entitlements?.plan?.slug
                        ? "border-[#49734F]"
                        : "border-[#EFF0F3]"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-[#232A25]">{plan.name ?? plan.display_name}</p>
                    <p className="text-sm text-[#49734F]">৳{getPrice(plan, billingCycle).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => void handleCheckout(plan)}
                    className={`py-2 rounded-[6px] text-sm disabled:opacity-60 ${
                      buttonState.disabled
                        ? "bg-[#EFF0F3] text-[#747775] cursor-not-allowed"
                        : "bg-[#49734F] text-white"
                    }`}
                  >
                    {checkoutLoading === plan.id ? "Processing..." : buttonState.label}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default AccountBilling;
