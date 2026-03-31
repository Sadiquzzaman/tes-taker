import GradeList from "@/component/grading/gradeList";
import GradingNameSection from "@/component/grading/gradingNameSection";
import PageLayout from "@/component/Layout";

export default function GradingPage() {
  return (
    <PageLayout route="/grading">
      <GradingNameSection />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-232px)]">
        <GradeList />
      </div>
    </PageLayout>
  );
}
