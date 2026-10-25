import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminTeachersTable from "@/component/Admin/AdminTeachersTable";

export default async function AdminTeachersPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/teachers" subText={t("teachers.title")}>
      <AdminTeachersTable />
    </PageLayout>
  );
}
