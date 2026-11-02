import PageLayout from "@/component/Layout";
import AttendanceSettingsPage from "@/component/Attendance/AttendanceSettingsPage";

export default function AttendanceSettingsRoute() {
  return (
    <PageLayout route="/attendance-settings">
      <AttendanceSettingsPage />
    </PageLayout>
  );
}
