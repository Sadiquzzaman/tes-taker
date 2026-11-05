import PageLayout from "@/component/Layout";
import ClassAttendancePage from "@/component/Attendance/ClassAttendancePage";

export default function ClassAttendanceRoute() {
  return (
    <PageLayout route="/attendance">
      <ClassAttendancePage />
    </PageLayout>
  );
}
