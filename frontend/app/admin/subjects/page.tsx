import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminSubjectsTable from "@/component/Admin/AdminSubjectsTable";

export default async function AdminSubjectsPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/subjects" subText={t("subjects.title")}>
      <AdminSubjectsTable />
    </PageLayout>
  );
}
