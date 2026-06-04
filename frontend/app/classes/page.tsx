import ClassesNameSection from "@/component/Classes/ClassesNameSection";
import ClassList from "@/component/Classes/ClassList";
import PageLayout from "@/component/Layout";
import { cookies } from "next/headers";

export default async function ClassesPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value as RoleUserType | undefined;

  return (
    <PageLayout route="/classes">
      <ClassesNameSection role={role} />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-232px)]">
        <ClassList role={role} />
      </div>
    </PageLayout>
  );
}
