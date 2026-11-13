import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import PageLayout from "@/component/Layout";
import ReportCardsPage from "@/component/ReportCards/ReportCardsPage";

export default function ReportCardsRoute() {
  return (
    <PageLayout route="/report-cards">
      <AttendanceWorkspaceGate page="reportCards">
        <ReportCardsPage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
