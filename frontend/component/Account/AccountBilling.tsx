"use client";

import { useState } from "react";
import Link from "next/link";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useGetPlans from "@/hooks/api/subscription/useGetPlans";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";

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

const AccountBilling = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { entitlements, loading: entitlementsLoading, refetch } = useEntitlements();
  const { plans, loading: plansLoading } = useGetPlans();
  const { triggerToast } = useToast();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

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
    } catch {
      triggerToast({
        title: "Checkout failed",
        description: "Unable to start payment. Please try again.",
        type: "error",
      });
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
            .map((plan) => (
              <div key={plan.id} className="border border-[#EFF0F3] rounded-[8px] p-4 flex flex-col gap-3">
                <div>
                  <p className="font-semibold text-[#232A25]">{plan.name ?? plan.display_name}</p>
                  <p className="text-sm text-[#49734F]">৳{getPrice(plan, billingCycle).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  disabled={checkoutLoading === plan.id}
                  onClick={() => void handleCheckout(plan)}
                  className="py-2 rounded-[6px] bg-[#49734F] text-white text-sm disabled:opacity-60"
                >
                  {checkoutLoading === plan.id ? "Processing..." : "Upgrade"}
                </button>
              </div>
            ))}
        </div>
      )}

      <Link href="/#pricing" className="text-sm text-[#49734F] hover:underline">
        Compare all plans
      </Link>
    </div>
  );
};

export default AccountBilling;
