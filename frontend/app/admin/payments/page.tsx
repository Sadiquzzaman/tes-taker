import PageLayout from "@/component/Layout";
import AdminPaymentsTable from "@/component/Admin/AdminPaymentsTable";

export default function AdminPaymentsPage() {
  return (
    <PageLayout route="/admin/payments" subText="Payments">
      <AdminPaymentsTable />
    </PageLayout>
  );
}
