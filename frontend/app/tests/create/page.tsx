import { Suspense } from "react";
import PageLayout from "@/component/Layout";
import CreateTestForm from "@/component/Tests/CreateTestForm";

export default async function CreateTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>;
}) {
  const { examId } = await searchParams;

  return (
    <PageLayout route="/tests" subText={examId ? "Edit test" : "Create test"}>
      <div className="w-full max-w-[896px] mx-auto">
        <Suspense fallback={null}>
          <CreateTestForm />
        </Suspense>
      </div>
    </PageLayout>
  );
}
