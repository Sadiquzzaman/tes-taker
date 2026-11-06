import PageLayout from "@/component/Layout";
import MyAttendancePage from "@/component/Attendance/MyAttendancePage";

export default function MyAttendanceRoute() {
  return (
    <PageLayout route="/my-attendance">
      <MyAttendancePage />
    </PageLayout>
  );
}
