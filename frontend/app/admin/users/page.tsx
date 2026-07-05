import PageLayout from "@/component/Layout";
import AdminUsersTable from "@/component/Admin/AdminUsersTable";

export default function AdminUsersPage() {
  return (
    <PageLayout route="/admin/users" subText="Users">
      <AdminUsersTable />
    </PageLayout>
  );
}
