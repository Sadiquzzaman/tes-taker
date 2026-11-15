import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import { MarkWriting } from "@/component/Ielts/Marking";

export default async function IeltsMarkWritingPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const t = await getTranslations("ieltsMarking");

  return (
    <PageLayout route="/ielts/marking" subText={t("crumb")}>
      <MarkWriting attemptId={attemptId} />
    </PageLayout>
  );
}
