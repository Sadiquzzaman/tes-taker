import PageLayout from "@/component/Layout";
import TestList from "@/component/Tests/TestList";
import TestsNameSection from "@/component/Tests/TestsNameSection";

export default function TestsPage() {
  return (
    <PageLayout route="/tests">
      <TestsNameSection />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-232px)]">
        <TestList />
      </div>
    </PageLayout>
  );
}
