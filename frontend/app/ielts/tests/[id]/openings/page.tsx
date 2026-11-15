import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import TestOpenings from "@/component/Ielts/TestOpenings";

export default async function IeltsTestOpeningsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("ieltsBuilder");
  const o = await getTranslations("ieltsOpenings");

  return (
    <PageLayout route="/ielts/tests" crumbs={[{ label: t("crumb"), href: `/ielts/tests/${id}` }]} subText={o("crumb")}>
      <TestOpenings testId={id} />
    </PageLayout>
  );
}
