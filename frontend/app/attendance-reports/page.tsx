import PageLayout from "@/component/Layout";
import ReportsPage from "@/component/Attendance/ReportsPage";

export default function AttendanceReportsRoute() {
  return (
    <PageLayout route="/attendance-reports">
      <ReportsPage />
    </PageLayout>
  );
}
