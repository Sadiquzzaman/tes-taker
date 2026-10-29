import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminFeatureRequestsTable from "@/component/Admin/AdminFeatureRequestsTable";

export default async function AdminFeatureRequestsPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/feature-requests" subText={t("featureRequests.title")}>
      <AdminFeatureRequestsTable />
    </PageLayout>
  );
}
