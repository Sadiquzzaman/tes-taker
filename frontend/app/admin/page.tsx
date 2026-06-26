import PageLayout from "@/component/Layout";
import AdminDashboard from "@/component/Admin/AdminDashboard";

export default function AdminPage() {
  return (
    <PageLayout route="/admin" subText="Admin">
      <AdminDashboard />
    </PageLayout>
  );
}
