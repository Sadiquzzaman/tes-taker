import PageLayout from "@/component/Layout";
import StudentPerformanceView from "@/component/Performance/StudentPerformanceView";

export default async function StudentPerformanceRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section_id?: string }> }) {
  const [{ id }, { section_id }] = await Promise.all([params, searchParams]);
  return (
    <PageLayout route="/performance">
      <StudentPerformanceView studentId={id} initialSectionId={section_id} />
    </PageLayout>
  );
}
