import PageLayout from "@/component/Layout";
import OrganizationOverview from "@/component/Organization/OrganizationOverview";

export default function OrganizationPage() {
  return (
    <PageLayout route="/organization">
      <OrganizationOverview />
    </PageLayout>
  );
}
