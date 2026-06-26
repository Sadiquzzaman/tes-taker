import PageLayout from "@/component/Layout";
import AdminTeachersTable from "@/component/Admin/AdminTeachersTable";

export default function AdminTeachersPage() {
  return (
    <PageLayout route="/admin/teachers" subText="Teachers">
      <AdminTeachersTable />
    </PageLayout>
  );
}
