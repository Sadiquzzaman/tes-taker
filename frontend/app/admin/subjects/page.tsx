import PageLayout from "@/component/Layout";
import AdminSubjectsTable from "@/component/Admin/AdminSubjectsTable";

export default function AdminSubjectsPage() {
  return (
    <PageLayout route="/admin/subjects" subText="Subjects">
      <AdminSubjectsTable />
    </PageLayout>
  );
}
