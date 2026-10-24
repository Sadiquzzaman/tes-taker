import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import AdminPaymentsTable from "@/component/Admin/AdminPaymentsTable";

export default async function AdminPaymentsPage() {
  const t = await getTranslations("admin");
  return (
    <PageLayout route="/admin/payments" subText={t("payments.title")}>
      <AdminPaymentsTable />
    </PageLayout>
  );
}
