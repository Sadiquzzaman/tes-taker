"use client";

import { useTranslations } from "next-intl";
import { Card, EmptyState } from "@/design/ui";
import useGetStudentClassList from "@/hooks/api/class/useGetStudentClassList";
import useWorkspace from "@/hooks/organization/useWorkspace";
import ClassGridSkeleton, { CLASS_GRID } from "./ClassGridSkeleton";
import StudentClassCard from "./StudentClassCard";

/** The student's classes in the current workspace. */
const StudentClassList = () => {
  const t = useTranslations("classes");
  const { workspace } = useWorkspace({ loadOrganizations: true });
  const { classList, loading } = useGetStudentClassList();
  const workspaceName =
    workspace.type === "organization" || workspace.type === "individual_teacher" ? workspace.name : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-ink-muted">{t("studentIntro", { workspace: workspaceName || t("workspaceFallback") })}</p>
      {loading ? (
        <ClassGridSkeleton />
      ) : classList.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyStudent")} />
        </Card>
      ) : (
        <div className={CLASS_GRID}>
          {classList.map((classItem, index) => (
            <StudentClassCard key={classItem.id} classItem={classItem} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentClassList;
