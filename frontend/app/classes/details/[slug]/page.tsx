import ClassDetailsComponent from "@/component/Classes/ClassDetailsComponent";
import PageLayout from "@/component/Layout";
import { cookies } from "next/headers";

export default async function ClassDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value as RoleUserType | undefined;
  const { slug } = await params;

  return (
    <PageLayout route="/classes" subText="Class Details">
      <ClassDetailsComponent classId={slug} role={role} />
    </PageLayout>
  );
}
