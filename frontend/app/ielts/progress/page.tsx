import PageLayout from "@/component/Layout";
import IeltsProgress from "@/component/Ielts/IeltsProgress";

export default function MyIeltsProgressPage() {
  return (
    <PageLayout route="/ielts/overview">
      <IeltsProgress />
    </PageLayout>
  );
}
