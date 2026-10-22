import PageLayout from "@/component/Layout";
import { OrganizationStudents } from "@/component/Organization/OrganizationMembers";

export default function OrganizationStudentsPage() {
  return (
    <PageLayout route="/organization/students">
      <OrganizationStudents />
    </PageLayout>
  );
}
