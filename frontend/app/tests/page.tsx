import PageLayout from "@/component/Layout";
import TestList from "@/component/Tests/TestList";
import TestsNameSection from "@/component/Tests/TestsNameSection";
import { cookies } from "next/headers";

export default async function TestsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value as RoleUserType | undefined;

  return (
    <PageLayout route="/tests">
      <TestsNameSection role={role} />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-232px)]">
        <TestList role={role} />
      </div>
    </PageLayout>
  );
}
