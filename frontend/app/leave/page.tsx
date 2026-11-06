import PageLayout from "@/component/Layout";
import LeavePage from "@/component/Attendance/LeavePage";

export default function LeaveRoute() {
  return (
    <PageLayout route="/leave">
      <LeavePage />
    </PageLayout>
  );
}
