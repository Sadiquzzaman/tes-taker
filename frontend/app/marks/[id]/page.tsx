import PageLayout from "@/component/Layout";
import MarksGrid from "@/component/Marks/MarksGrid";

export default async function MarksGridRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageLayout route="/marks">
      <MarksGrid id={id} />
    </PageLayout>
  );
}
