import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import ExamDetails from "@/component/Tests/ExamDetails";

export default async function ExamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("tests");

  return (
    <PageLayout route="/tests" subText={t("details.title")}>
      <ExamDetails examId={id} />
    </PageLayout>
  );
}
