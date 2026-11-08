import PageLayout from "@/component/Layout";
import TodayPage from "@/component/Today/TodayPage";

export default function TodayRoute() {
  return (
    <PageLayout route="/today">
      <TodayPage />
    </PageLayout>
  );
}
