"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import StudentWorkspaceCards from "@/component/Dashboard/StudentWorkspaceCards";
import { Card, EmptyState, PageHeader, Skeleton } from "@/design/ui";
import { useStorageItem } from "@/hooks/useBrowserStorage";
import { getStoredUser } from "@/lib/authSession";
import { workspaceFromUser } from "@/lib/workspace";

/**
 * Attendance and homework belong to a workspace: a school, or a teacher's own classes. A student who has not
 * chosen one yet (just signed in) sees their workspaces here instead of a load error; choosing one
 * reloads the same page inside it. Everyone else sees the page as it is.
 */
const AttendanceWorkspaceGate = ({ page, children }: { page: "myAttendance" | "leave" | "homework" | "routine"; children: ReactNode }) => {
  const t = useTranslations("attendanceWorkspace");
  const tPage = useTranslations(page);
  // undefined on the server and while hydrating; then the signed-in user as stored.
  const stored = useStorageItem("local", "user");

  if (stored === undefined) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={3} />
      </Card>
    );
  }

  const user = stored === null ? null : getStoredUser();
  const needsWorkspace = user?.role === "STUDENT" && workspaceFromUser(user).type === "individual";
  if (!needsWorkspace) return <>{children}</>;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={tPage("title")} />
      <Card>
        <EmptyState title={t("title")} description={t("intro")} />
      </Card>
      <StudentWorkspaceCards stayOnPage />
    </div>
  );
};

export default AttendanceWorkspaceGate;
