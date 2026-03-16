import ClassDetailsComponent from "@/component/Classes/ClassDetailsComponent";
import PageLayout from "@/component/Layout";

export default async function ClassDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  console.log("slug", slug);
  return (
    <PageLayout route="/classes" subText="Class Details">
      <ClassDetailsComponent classId={slug} />
    </PageLayout>
  );
}
