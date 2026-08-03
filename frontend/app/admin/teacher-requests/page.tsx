import PageLayout from "@/component/Layout";
import AdminTeacherRequestsTable from "@/component/Admin/AdminTeacherRequestsTable";

export default function AdminTeacherRequestsPage() {
  return (
    <PageLayout route="/admin/teacher-requests" subText="Teacher Requests">
      <AdminTeacherRequestsTable />
    </PageLayout>
  );
}
