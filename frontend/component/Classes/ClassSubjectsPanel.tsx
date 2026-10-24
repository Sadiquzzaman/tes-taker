"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";

const teacherName = (assignment: ClassSubjectTeacherAssignment) =>
  assignment.teacher?.full_name?.trim() || "Teacher";

const ClassSubjectsPanel = ({ classId }: { classId: string }) => {
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

  if (loading) {
    return <p className="p-4 text-sm text-ink-muted">Loading subjects...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {activeOrganization?.role && (
        <div className="rounded-input border border-border p-4">
          <p className="text-body-sm text-ink-muted">
            Subject attachment and teacher assignment are managed from the organization Assignments page.
          </p>
        </div>
      )}

      {subjects.length === 0 ? (
        <p className="text-sm text-ink-muted">No subjects are attached to this class yet.</p>
      ) : (
        subjects.map((row) => {
          const names = (row.teachers ?? []).map(teacherName);

          return (
            <div key={row.id} className="flex flex-col gap-3 rounded-input border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body font-semibold text-ink">
                  {row.subject?.code
                    ? `${row.subject.name || "Subject"} (${row.subject.code})`
                    : row.subject?.name || "Subject"}
                  <span className="ml-2 font-normal text-ink-muted">
                    {names.length > 0 ? names.join(", ") : "No teacher assigned"}
                  </span>
                </p>
              </div>

              {(row.teachers ?? []).map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between text-sm text-ink">
                  <span>{teacherName(assignment)}</span>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

export default ClassSubjectsPanel;
