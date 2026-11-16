import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import SimilarityReport from "@/component/Integrity/SimilarityReport";

export default async function IeltsWritingSimilarityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("plagiarism");

  return (
    <PageLayout route="/ielts/tests" subText={t("crumb")}>
      <SimilarityReport scopeType="IELTS_WRITING" scopeId={id} back={{ href: "/ielts/tests", label: t("backToTests") }} />
    </PageLayout>
  );
}
