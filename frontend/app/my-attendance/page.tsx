import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import MyAttendancePage from "@/component/Attendance/MyAttendancePage";

export default function MyAttendanceRoute() {
  return (
    <PageLayout route="/my-attendance">
      <AttendanceWorkspaceGate page="myAttendance">
        <MyAttendancePage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
