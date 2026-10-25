import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import CreateTestForm from "@/component/Tests/CreateTestForm";

export default async function CreateTestsPage({ searchParams }: { searchParams: Promise<{ examId?: string }> }) {
  const { examId } = await searchParams;
  const t = await getTranslations("createTest");

  return (
    <PageLayout route="/tests" subText={examId ? t("editTitle") : t("title")}>
      <div className="mx-auto w-full max-w-6xl">
        <Suspense fallback={null}>
          <CreateTestForm />
        </Suspense>
      </div>
    </PageLayout>
  );
}
