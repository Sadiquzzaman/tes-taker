import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import Examiner from "@/component/Ielts/speaking/Examiner";

export default async function IeltsExaminerPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const t = await getTranslations("ieltsSpeaking");

  return (
    <PageLayout route="/ielts/marking" subText={t("crumb")}>
      <Examiner attemptId={attemptId} />
    </PageLayout>
  );
}
