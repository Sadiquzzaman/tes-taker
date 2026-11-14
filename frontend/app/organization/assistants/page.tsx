import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import { OrganizationAssistants } from "@/component/Organization/OrganizationMembers";

export default async function OrganizationAssistantsPage() {
  const crumbs = await getTranslations("breadcrumbs");
  return (
    <PageLayout route="/organization" crumbs={[]} subText={crumbs("assistants")}>
      <OrganizationAssistants />
    </PageLayout>
  );
}
