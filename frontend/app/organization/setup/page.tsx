import PageLayout from "@/component/Layout";
import SetupWizard from "@/component/Academics/setup/SetupWizard";

export default function OrganizationSetupPage() {
  return (
    <PageLayout route="/organization">
      <SetupWizard />
    </PageLayout>
  );
}
