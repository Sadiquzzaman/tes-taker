import PageLayout from "@/component/Layout";
import GradingScalePage from "@/component/GradingScale/GradingScalePage";

export default function GradingScaleRoute() {
  return (
    <PageLayout route="/grading-scale">
      <GradingScalePage />
    </PageLayout>
  );
}
