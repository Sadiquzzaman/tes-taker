import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import HomeworkSimilarity from "@/component/Integrity/HomeworkSimilarity";

export default async function HomeworkSimilarityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("plagiarism");

  return (
    <PageLayout route="/homework" subText={t("crumb")}>
      <HomeworkSimilarity homeworkId={id} />
    </PageLayout>
  );
}
