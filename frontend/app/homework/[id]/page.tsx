import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import HomeworkDetail from "@/component/Homework/HomeworkDetail";

export default async function HomeworkDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const crumbs = await getTranslations("breadcrumbs");
  const { id } = await params;
  return (
    <PageLayout route="/homework" crumbs={[]} subText={crumbs("homework")}>
      <AttendanceWorkspaceGate page="homework">
        <HomeworkDetail id={id} />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
