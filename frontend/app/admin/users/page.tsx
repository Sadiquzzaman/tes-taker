import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminUsersTable from "@/component/Admin/AdminUsersTable";

export default async function AdminUsersPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/users" subText={t("users.title")}>
      <AdminUsersTable />
    </PageLayout>
  );
}
