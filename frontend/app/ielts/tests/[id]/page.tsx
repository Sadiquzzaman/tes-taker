import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import IeltsTestBuilder from "@/component/Ielts/IeltsTestBuilder";

export default async function IeltsTestBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("ieltsBuilder");

  return (
    <PageLayout route="/ielts/tests" subText={t("crumb")}>
      <IeltsTestBuilder testId={id} />
    </PageLayout>
  );
}
