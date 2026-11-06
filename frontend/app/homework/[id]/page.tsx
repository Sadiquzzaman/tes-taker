import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import HomeworkDetail from "@/component/Homework/HomeworkDetail";

export default async function HomeworkDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageLayout route="/homework">
      <AttendanceWorkspaceGate page="homework">
        <HomeworkDetail id={id} />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
