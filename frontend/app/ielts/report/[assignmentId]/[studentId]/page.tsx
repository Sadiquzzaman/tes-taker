import BandReport from "@/component/Ielts/BandReport";

/** The band report prints on its own page (no side menu). */
export default async function IeltsBandReportPage({ params }: { params: Promise<{ assignmentId: string; studentId: string }> }) {
  const { assignmentId, studentId } = await params;
  return <BandReport assignmentId={assignmentId} studentId={studentId} />;
}
