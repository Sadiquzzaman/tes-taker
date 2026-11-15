import IeltsAttemptScreen from "@/component/Ielts/take/IeltsAttemptScreen";

/** The test screen fills the window, like the real computer-delivered test (no side menu). */
export default async function IeltsAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IeltsAttemptScreen attemptId={id} />;
}
