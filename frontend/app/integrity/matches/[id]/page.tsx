import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import MatchReview from "@/component/Integrity/MatchReview";

export default async function SimilarityMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("plagiarism");

  return (
    <PageLayout route="/homework" subText={t("matchCrumb")}>
      <MatchReview matchId={id} />
    </PageLayout>
  );
}
