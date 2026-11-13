import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import StudentPerformanceView from "@/component/Performance/StudentPerformanceView";

export default async function StudentPerformanceRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section_id?: string }> }) {
  const crumbs = await getTranslations("breadcrumbs");
  const [{ id }, { section_id }] = await Promise.all([params, searchParams]);
  return (
    <PageLayout route="/performance" crumbs={[]} subText={crumbs("student")}>
      <StudentPerformanceView studentId={id} initialSectionId={section_id} />
    </PageLayout>
  );
}
