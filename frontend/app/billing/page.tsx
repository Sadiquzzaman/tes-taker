import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import AccountBilling from "@/component/Account/AccountBilling";
import StorageUsageCard from "@/component/Files/StorageUsageCard";
import SmsCreditsCard from "@/component/Notifications/SmsCreditsCard";
import PageLayout from "@/component/Layout";
import { PageHeader, Skeleton } from "@/design/ui";

export default async function BillingPage() {
  const t = await getTranslations("billing");
  return (
    <PageLayout route="/billing" subText={t("title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
        <PageHeader title={t("title")} description={t("intro")} />
        <Suspense fallback={<Skeleton className="h-40 rounded-card" />}>
          <AccountBilling />
        </Suspense>
        <StorageUsageCard />
        <SmsCreditsCard />
      </div>
    </PageLayout>
  );
}
