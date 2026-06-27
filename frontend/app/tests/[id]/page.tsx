import PageLayout from "@/component/Layout";
import ExamDetails from "@/component/Tests/ExamDetails";

export default async function ExamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageLayout route="/tests" subText="Test details">
      <ExamDetails examId={id} />
    </PageLayout>
  );
}
