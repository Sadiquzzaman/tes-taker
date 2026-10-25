import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminPlansManager from "@/component/Admin/AdminPlansManager";

export default async function AdminPlansPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/plans" subText={t("plans.title")}>
      <AdminPlansManager />
    </PageLayout>
  );
}
