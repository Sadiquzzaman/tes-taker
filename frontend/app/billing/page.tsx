import { Suspense } from "react";
import PageLayout from "@/component/Layout";
import AccountBilling from "@/component/Account/AccountBilling";

export default function BillingPage() {
  return (
    <PageLayout route="/billing" subText="Billing & Plans">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[24px] font-[600] text-[#232A25]">Billing & Plans</h1>
          <p className="text-sm text-[#747775]">Choose a plan and upgrade your account.</p>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 animate-pulse h-40" />}>
          <AccountBilling />
        </Suspense>
      </div>
    </PageLayout>
  );
}
