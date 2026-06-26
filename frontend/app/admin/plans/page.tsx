import PageLayout from "@/component/Layout";
import AdminPlansManager from "@/component/Admin/AdminPlansManager";

export default function AdminPlansPage() {
  return (
    <PageLayout route="/admin/plans" subText="Plan management">
      <AdminPlansManager />
    </PageLayout>
  );
}
