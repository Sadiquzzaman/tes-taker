import PageLayout from "@/component/Layout";
import AdminOrganizationsTable from "@/component/Admin/AdminOrganizationsTable";

export default function AdminOrganizationsPage() {
  return (
    <PageLayout route="/admin/organizations" subText="Organizations">
      <AdminOrganizationsTable />
    </PageLayout>
  );
}
