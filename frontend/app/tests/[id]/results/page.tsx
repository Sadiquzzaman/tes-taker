import PageLayout from "@/component/Layout";
import StudentExamResults from "@/component/Tests/StudentExamResults";

export default async function StudentExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageLayout route="/tests" subText="Exam results">
      <StudentExamResults examId={id} />
    </PageLayout>
  );
}
