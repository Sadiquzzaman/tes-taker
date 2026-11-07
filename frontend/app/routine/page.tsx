import PageLayout from "@/component/Layout";
import AttendanceWorkspaceGate from "@/component/Attendance/AttendanceWorkspaceGate";
import RoutinePage from "@/component/Routine/RoutinePage";

export default function RoutineRoute() {
  return (
    <PageLayout route="/routine">
      <AttendanceWorkspaceGate page="routine">
        <RoutinePage />
      </AttendanceWorkspaceGate>
    </PageLayout>
  );
}
