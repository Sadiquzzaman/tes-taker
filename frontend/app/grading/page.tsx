import GradeList from "@/component/grading/gradeList";
import GradingNameSection from "@/component/grading/gradingNameSection";
import PageLayout from "@/component/Layout";

export default function GradingPage() {
  return (
    <PageLayout route="/grading">
      <div className="pb-8">
        <GradingNameSection />
        <GradeList />
      </div>
    </PageLayout>
  );
}
