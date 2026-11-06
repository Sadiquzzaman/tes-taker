import PageLayout from "@/component/Layout";
import HomeworkSettingsPage from "@/component/Homework/HomeworkSettingsPage";

export default function HomeworkSettingsRoute() {
  return (
    <PageLayout route="/homework-settings">
      <HomeworkSettingsPage />
    </PageLayout>
  );
}
