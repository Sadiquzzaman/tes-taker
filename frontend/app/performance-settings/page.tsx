import PageLayout from "@/component/Layout";
import PerformanceSettingsPage from "@/component/Performance/PerformanceSettingsPage";

export default function PerformanceSettingsRoute() {
  return (
    <PageLayout route="/performance-settings">
      <PerformanceSettingsPage />
    </PageLayout>
  );
}
