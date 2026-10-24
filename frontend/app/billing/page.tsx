import { Suspense } from "react";
import PageLayout from "@/component/Layout";
import AccountBilling from "@/component/Account/AccountBilling";

export default function BillingPage() {
  return (
    <PageLayout route="/billing" subText="Billing & Plans">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-title font-semibold text-ink">Billing & Plans</h1>
          <p className="text-sm text-ink-muted">Choose a plan and upgrade your account.</p>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-border bg-surface p-6 animate-pulse h-40" />}>
          <AccountBilling />
        </Suspense>
      </div>
    </PageLayout>
  );
}
