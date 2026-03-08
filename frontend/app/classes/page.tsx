import ClassesNameSection from "@/component/Classes/ClassesNameSection";
import PageLayout from "@/component/Layout";

export default function ClassesPage() {
  return (
    <PageLayout route="/classes">
      <ClassesNameSection />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-232px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4"></div>
      </div>
    </PageLayout>
  );
}
