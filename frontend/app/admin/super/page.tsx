import PageLayout from "@/component/Layout";
import SuperAdminPanel from "@/component/Admin/SuperAdminPanel";

export default function SuperAdminPage() {
  return (
    <PageLayout route="/admin/super" subText="Super Admin">
      <SuperAdminPanel />
    </PageLayout>
  );
}
