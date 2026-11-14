import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import MarksGrid from "@/component/Marks/MarksGrid";

export default async function MarksGridRoute({ params }: { params: Promise<{ id: string }> }) {
  const crumbs = await getTranslations("breadcrumbs");
  const { id } = await params;
  return (
    <PageLayout route="/marks" crumbs={[]} subText={crumbs("marks")}>
      <MarksGrid id={id} />
    </PageLayout>
  );
}
