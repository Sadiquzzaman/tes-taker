import PageLayout from "@/component/Layout";
import { OrganizationTeachers } from "@/component/Organization/OrganizationMembers";

export default function OrganizationTeachersPage() {
  return (
    <PageLayout route="/organization/teachers">
      <OrganizationTeachers />
    </PageLayout>
  );
}
