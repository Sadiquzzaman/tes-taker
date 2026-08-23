import PageLayout from "@/component/Layout";
import OrganizationAssignments from "@/component/Organization/OrganizationAssignments";

export default function OrganizationAssignmentsPage() {
  return (
    <PageLayout route="/organization/assignments">
      <OrganizationAssignments />
    </PageLayout>
  );
}
