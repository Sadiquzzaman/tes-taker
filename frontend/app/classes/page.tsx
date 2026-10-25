import ClassesNameSection from "@/component/Classes/ClassesNameSection";
import ClassList from "@/component/Classes/ClassList";
import ShareClassModal from "@/component/Classes/ShareClassModal";
import PageLayout from "@/component/Layout";
import { cookies } from "next/headers";

export default async function ClassesPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value as RoleUserType | undefined;

  return (
    <PageLayout route="/classes">
      <div className="pb-8">
        <ClassesNameSection role={role} />
        <ClassList role={role} />
        <ShareClassModal />
      </div>
    </PageLayout>
  );
}
