import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import IntegrityReport from "@/component/Tests/integrity/IntegrityReport";

export default async function IntegrityReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("integrity");

  return (
    <PageLayout route="/tests" subText={t("title")}>
      <IntegrityReport examId={id} />
    </PageLayout>
  );
}
