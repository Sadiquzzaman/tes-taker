import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import IeltsProgress from "@/component/Ielts/IeltsProgress";

export default async function IeltsStudentProgressPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const t = await getTranslations("ieltsProgress");

  return (
    <PageLayout route="/ielts/students" subText={t("crumb")}>
      <IeltsProgress studentId={studentId} />
    </PageLayout>
  );
}
