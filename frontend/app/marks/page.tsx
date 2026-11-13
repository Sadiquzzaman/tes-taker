import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import MarksPage from "@/component/Marks/MarksPage";

export default function MarksRoute() {
  return (
    <PageLayout route="/marks">
      <AttendanceWorkspaceGate page="marks">
        <MarksPage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
