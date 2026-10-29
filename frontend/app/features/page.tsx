import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import MoreFeatures from "@/component/Subscription/MoreFeatures";
import { PageHeader } from "@/design/ui";

export default async function FeaturesPage() {
  const t = await getTranslations("features.page");
  return (
    <PageLayout route="/features" subText={t("title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
        <PageHeader title={t("title")} description={t("intro")} />
        <MoreFeatures />
      </div>
    </PageLayout>
  );
}
