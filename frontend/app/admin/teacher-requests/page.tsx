import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminTeacherRequestsTable from "@/component/Admin/AdminTeacherRequestsTable";

export default async function AdminTeacherRequestsPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/teacher-requests" subText={t("teacherRequests.title")}>
      <AdminTeacherRequestsTable />
    </PageLayout>
  );
}
