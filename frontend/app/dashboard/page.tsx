import PageLayout from "@/component/Layout";
import DashboardPageContent from "@/component/Dashboard/DashboardPageContent";

export default function DashboardPage() {
  return (
    <PageLayout route="/dashboard">
      <DashboardPageContent />
    </PageLayout>
  );
}
