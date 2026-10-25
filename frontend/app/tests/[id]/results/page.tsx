import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import StudentExamResults from "@/component/Tests/StudentExamResults";

export default async function StudentExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("tests");

  return (
    <PageLayout route="/tests" subText={t("results.title")}>
      <StudentExamResults examId={id} />
    </PageLayout>
  );
}
