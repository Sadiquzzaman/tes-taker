import PageLayout from "@/component/Layout";
import CreateTestForm from "@/component/Tests/CreateTestForm";

export default function CreateTestsPage() {
  return (
    <PageLayout route="/tests" subText="Create test">
      <div className="w-full max-w-[896px] mx-auto">
        <CreateTestForm />
      </div>
    </PageLayout>
  );
}
