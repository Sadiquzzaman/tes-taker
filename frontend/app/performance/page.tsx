import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import PageLayout from "@/component/Layout";
import PerformancePage from "@/component/Performance/PerformancePage";

export default function PerformanceRoute() {
  return (
    <PageLayout route="/performance">
      <AttendanceWorkspaceGate page="performance">
        <PerformancePage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
