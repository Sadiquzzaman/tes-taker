import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import HomeworkPage from "@/component/Homework/HomeworkPage";

export default function HomeworkRoute() {
  return (
    <PageLayout route="/homework">
      <AttendanceWorkspaceGate page="homework">
        <HomeworkPage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
