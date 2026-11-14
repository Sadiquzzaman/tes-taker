import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import SetupWizard from "@/component/Academics/setup/SetupWizard";

export default async function OrganizationSetupPage() {
  const crumbs = await getTranslations("breadcrumbs");
  return (
    <PageLayout route="/organization" crumbs={[]} subText={crumbs("setup")}>
      <SetupWizard />
    </PageLayout>
  );
}
