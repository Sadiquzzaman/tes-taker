import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import MatchReview from "@/component/Integrity/MatchReview";

export default async function SimilarityMatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  // Opened from an IELTS opening's check: the IELTS menu and breadcrumb, not Homework.
  const ielts = (await searchParams).from === "ielts";
  const t = await getTranslations("plagiarism");

  return (
    <PageLayout route={ielts ? "/ielts/tests" : "/homework"} subText={t("matchCrumb")}>
      <MatchReview matchId={id} />
    </PageLayout>
  );
}
