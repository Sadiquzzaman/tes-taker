import PageLayout from "@/component/Layout";
import SessionsPage from "@/component/Academics/SessionsPage";

export default function AcademicSessionsPage() {
  return (
    <PageLayout route="/sessions">
      <SessionsPage />
    </PageLayout>
  );
}
