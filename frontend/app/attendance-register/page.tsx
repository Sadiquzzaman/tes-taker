import PageLayout from "@/component/Layout";
import RegisterPage from "@/component/Attendance/RegisterPage";

export default function AttendanceRegisterRoute() {
  return (
    <PageLayout route="/attendance-register">
      <RegisterPage />
    </PageLayout>
  );
}
