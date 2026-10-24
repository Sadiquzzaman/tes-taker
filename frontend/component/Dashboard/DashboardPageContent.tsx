"use client";

import { useTranslations } from "next-intl";
import { Card, ErrorState } from "@/design/ui";
import { DashboardProvider, useDashboard } from "@/context/DashboardContext";
import { useIsClient } from "@/hooks/useBrowserStorage";
import { getStoredUser } from "@/lib/authSession";
import Calendar from "./Calendar";
import LiveTest from "./LiveTest";
import MyActivity from "./MyActivity";
import MyClasses from "./MyClasses";
import NameSection from "./NameSection";
import NeedsMarking from "./NeedsMarking";
import StartingSoon from "./StartingSoon";
import StudentWorkspaceCards from "./StudentWorkspaceCards";
import TopStudents from "./TopStudents";
import TotalStudents from "./TotalStudents";
import UpcomingTests from "./UpcomingTests";

/** Teacher home ("Today" first, design-system §3.4): what needs action now, then the overview. */
const TeacherDashboard = () => {
  const t = useTranslations("dashboard");
  const { data, loading, error, refetch } = useDashboard();

  if (error && !loading && !data) {
    return (
      <Card>
        <ErrorState description={t("loadFailed")} onRetry={() => void refetch()} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("today.label")} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NeedsMarking />
        <LiveTest />
        <StartingSoon />
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingTests />
        </div>
        <TotalStudents />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyClasses />
        <TopStudents />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Calendar />
        <MyActivity />
      </div>
    </div>
  );
};

const DashboardInner = () => {
  const isClient = useIsClient();
  const isStudent = isClient && getStoredUser()?.role === "STUDENT";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <NameSection variant={isStudent ? "student" : "teacher"} />
      {isStudent ? <StudentWorkspaceCards /> : <TeacherDashboard />}
    </div>
  );
};

/** /dashboard: the teacher's "Today" home, or the student's list of workspaces. */
const DashboardPageContent = () => (
  <DashboardProvider>
    <DashboardInner />
  </DashboardProvider>
);

export default DashboardPageContent;
