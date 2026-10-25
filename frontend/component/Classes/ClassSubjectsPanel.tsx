"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { useTranslations } from "next-intl";
import { Card, EmptyState, Skeleton, Table, type TableColumn } from "@/design/ui";

const teacherName = (assignment: ClassSubjectTeacherAssignment, fallback: string) =>
  assignment.teacher?.full_name?.trim() || fallback;

/** The subjects taught in an organisation class and who teaches each (read-only; managed in Assignments). */
const ClassSubjectsPanel = ({ classId }: { classId: string }) => {
  const t = useTranslations("classes.subjects");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const classSubjectsRes = await axiosReq.get<ApiResponse<ClassSubject[]>>(
        `${baseUrl}/classes/${classId}/subjects`,
      );
      setSubjects(classSubjectsRes.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, classId, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjectName = (row: ClassSubject) =>
    row.subject?.code ? `${row.subject.name || t("subject")} (${row.subject.code})` : row.subject?.name || t("subject");

  const columns: TableColumn<ClassSubject>[] = [
    { key: "subject", header: t("subject"), cell: subjectName, sortValue: subjectName },
    {
      key: "teachers",
      header: t("teacher"),
      cell: (row) => {
        const names = (row.teachers ?? []).map((assignment) => teacherName(assignment, t("teacher")));
        return names.length ? names.join(", ") : <span className="text-ink-muted">{t("noTeacher")}</span>;
      },
    },
  ];

  return (
    <Card>
      <div className="flex flex-col gap-4">
        {activeOrganization?.role ? <p className="text-body-sm text-ink-muted">{t("managedByOrg")}</p> : null}
        {loading ? (
          <Skeleton lines={4} />
        ) : subjects.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <Table caption={t("subject")} columns={columns} rows={subjects} getRowId={(row) => row.id} />
        )}
      </div>
    </Card>
  );
};

export default ClassSubjectsPanel;
