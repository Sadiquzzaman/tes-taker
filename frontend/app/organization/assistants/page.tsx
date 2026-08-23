import PageLayout from "@/component/Layout";
import { OrganizationAssistants } from "@/component/Organization/OrganizationMembers";

export default function OrganizationAssistantsPage() {
  return (
    <PageLayout route="/organization">
      <OrganizationAssistants />
    </PageLayout>
  );
}
