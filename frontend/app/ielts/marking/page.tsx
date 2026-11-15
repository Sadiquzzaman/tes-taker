import PageLayout from "@/component/Layout";
import { MarkingList } from "@/component/Ielts/Marking";

export default function IeltsMarkingPage() {
  return (
    <PageLayout route="/ielts/marking">
      <MarkingList />
    </PageLayout>
  );
}
