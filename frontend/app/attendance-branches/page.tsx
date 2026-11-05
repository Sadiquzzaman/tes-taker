import PageLayout from "@/component/Layout";
import BranchesPage from "@/component/Attendance/BranchesPage";

export default function AttendanceBranchesRoute() {
  return (
    <PageLayout route="/attendance-branches">
      <BranchesPage />
    </PageLayout>
  );
}
