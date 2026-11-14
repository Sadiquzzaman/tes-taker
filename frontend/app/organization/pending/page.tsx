import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import OrganizationPendingContent from "./pending-content";

export default async function OrganizationPendingPage() {
  const crumbs = await getTranslations("breadcrumbs");
  return (
    <PageLayout route="/organization" crumbs={[]} subText={crumbs("pending")}>
      <OrganizationPendingContent />
    </PageLayout>
  );
}
