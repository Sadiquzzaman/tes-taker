import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import LiveMonitor from "@/component/Tests/monitor/LiveMonitor";

export default async function LiveMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("monitor");

  return (
    <PageLayout route="/tests" subText={t("title")}>
      <LiveMonitor examId={id} />
    </PageLayout>
  );
}
