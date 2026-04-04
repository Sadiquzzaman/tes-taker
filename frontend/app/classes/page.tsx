import ClassesNameSection from "@/component/Classes/ClassesNameSection";
import ClassList from "@/component/Classes/ClassList";
import PageLayout from "@/component/Layout";

export default function ClassesPage() {
  return (
    <PageLayout route="/classes">
      <ClassesNameSection />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-232px)]">
        <ClassList />
      </div>
    </PageLayout>
  );
}
