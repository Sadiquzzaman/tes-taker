import PageLayout from "@/component/Layout";
import TestList from "@/component/Tests/TestList";
import TestsNameSection from "@/component/Tests/TestsNameSection";
import { cookies } from "next/headers";

export default async function TestsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value as RoleUserType | undefined;

  return (
    <PageLayout route="/tests">
      <div className="pb-8">
        <TestsNameSection role={role} />
        <TestList role={role} />
      </div>
    </PageLayout>
  );
}
