import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import LeavePage from "@/component/Attendance/LeavePage";

export default function LeaveRoute() {
  return (
    <PageLayout route="/leave">
      <AttendanceWorkspaceGate page="leave">
        <LeavePage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
