import PageLayout from "@/component/Layout";
import HolidaysPage from "@/component/Attendance/HolidaysPage";

export default function HolidaysRoute() {
  return (
    <PageLayout route="/holidays">
      <HolidaysPage />
    </PageLayout>
  );
}
