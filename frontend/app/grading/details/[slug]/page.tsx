import GradeDetailsComponent from "@/component/grading/GradeDetailsComponent";
import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";

export default async function GradeDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("grading.details");
  return (
    <PageLayout route="/grading" subText={t("title")}>
      <GradeDetailsComponent classId={slug} />
    </PageLayout>
  );
}
