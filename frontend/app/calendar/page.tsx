import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import CalendarPage from "@/component/Calendar/CalendarPage";

export default function CalendarRoute() {
  return (
    <PageLayout route="/calendar">
      <AttendanceWorkspaceGate page="calendar">
        <CalendarPage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
