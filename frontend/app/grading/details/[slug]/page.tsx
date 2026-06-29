import GradeDetailsComponent from "@/component/grading/GradeDetailsComponent";
import PageLayout from "@/component/Layout";

export default async function ClassDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PageLayout route="/grading" subText="Test Details">
      <GradeDetailsComponent classId={slug} />
    </PageLayout>
  );
}
