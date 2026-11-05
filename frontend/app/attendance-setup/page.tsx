import PageLayout from "@/component/Layout";
import ClassSetupPage from "@/component/Attendance/ClassSetupPage";

export default function AttendanceSetupRoute() {
  return (
    <PageLayout route="/attendance-setup">
      <ClassSetupPage />
    </PageLayout>
  );
}
