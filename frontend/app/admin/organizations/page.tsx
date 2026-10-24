import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminOrganizationsTable from "@/component/Admin/AdminOrganizationsTable";

export default async function AdminOrganizationsPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/organizations" subText={t("organizations.title")}>
      <AdminOrganizationsTable />
    </PageLayout>
  );
}
