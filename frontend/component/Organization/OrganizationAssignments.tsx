"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  Combobox,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

const subjectLabel = (row: ClassSubject, fallback: string) =>
  row.subject?.code ? `${row.subject.name} — ${row.subject.code}` : row.subject?.name || fallback;

const catalogSubjectLabel = (subject: OrganizationSubjectItem) => (subject.code ? `${subject.name} — ${subject.code}` : subject.name);

const teacherLabel = (member: OrganizationMemberItem, fallback: string) => member.user.full_name || member.user.phone || fallback;

const assignmentTeacherName = (assignment: ClassSubjectTeacherAssignment, fallback: string) => assignment.teacher?.full_name?.trim() || fallback;

type PendingRemoval =
  | { kind: "subject"; classId: string; className: string; classSubjectId: string; subject: string }
  | { kind: "teacher"; classId: string; className: string; classSubjectId: string; assignmentId: string; subject: string; teacher: string };

/** Which subjects each class has, and which teacher teaches each one. */
const OrganizationAssignmentsContent = () => {
  const t = useTranslations("organization.assignments");
  const subjectFallback = t("subject");
  const teacherFallback = t("teacher");
  const unassignedLabel = t("unassigned");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const step2Ref = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [catalog, setCatalog] = useState<OrganizationSubjectItem[]>([]);
  const [teachers, setTeachers] = useState<OrganizationMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] = useState("");
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [tableClassFilter, setTableClassFilter] = useState("all");
  const [tableSubjectFilter, setTableSubjectFilter] = useState("all");
  const [tableTeacherFilter, setTableTeacherFilter] = useState("all");
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);

  const resetFormState = useCallback(() => {
    setSelectedClassId("");
    setSelectedCatalogSubjectId("");
    setSelectedClassSubjectId("");
    setSelectedTeacherId("");
    setEditingAssignmentId("");
    setTableClassFilter("all");
    setTableSubjectFilter("all");
    setTableTeacherFilter("all");
  }, []);

  const load = useCallback(async () => {
    if (!organizationId) {
      setClasses([]);
      setCatalog([]);
      setTeachers([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const [classRes, catalogRes, teacherRes] = await Promise.all([
        axiosReq.get<ApiResponse<Class[]>>(`${baseUrl}/classes`),
        axiosReq.get<ApiResponse<OrganizationSubjectItem[]>>(
          `${baseUrl}/organizations/${organizationId}/subjects`,
        ),
        axiosReq.get<ApiResponse<OrganizationMemberItem[]>>(
          `${baseUrl}/organizations/${organizationId}/assignable-teachers`,
        ),
      ]);
      const nextClasses = classRes.data?.payload ?? [];
      setClasses(nextClasses);
      setCatalog(catalogRes.data?.payload ?? []);
      setTeachers(teacherRes.data?.payload ?? []);
      return nextClasses;
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setClasses([]);
      setCatalog([]);
      setTeachers([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    resetFormState();
  }, [organizationId, resetFormState]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const classSubjects = useMemo(() => selectedClass?.classSubjects ?? [], [selectedClass]);
  const classOptions = useMemo(
    () => classes.map((item) => ({ label: item.class_name, value: item.id })),
    [classes],
  );
  const attachedSubjectOptions = useMemo(
    () => classSubjects.map((row) => ({ label: subjectLabel(row, subjectFallback), value: row.id })),
    [classSubjects, subjectFallback],
  );
  const attachableSubjectOptions = useMemo(() => {
    const attachedIds = new Set(classSubjects.map((row) => row.subject_id));
    return catalog
      .filter((subject) => !attachedIds.has(subject.id))
      .map((subject) => ({
        label: catalogSubjectLabel(subject),
        value: subject.id,
      }));
  }, [catalog, classSubjects]);
  const selectedClassSubject = classSubjects.find((item) => item.id === selectedClassSubjectId);
  const assignedTeacherIds = useMemo(
    () => new Set((selectedClassSubject?.teachers ?? []).map((assignment) => assignment.teacher_id)),
    [selectedClassSubject],
  );
  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((member) => {
          if (!assignedTeacherIds.has(member.user.id)) return true;
          return Boolean(
            editingAssignmentId &&
              selectedClassSubject?.teachers?.some(
                (assignment) => assignment.id === editingAssignmentId && assignment.teacher_id === member.user.id,
              ),
          );
        })
        .map((member) => ({ label: teacherLabel(member, teacherFallback), value: member.user.id })),
    [assignedTeacherIds, editingAssignmentId, selectedClassSubject, teacherFallback, teachers],
  );

  const assignmentRows = useMemo(
    () =>
      classes.flatMap((classItem) =>
        (classItem.classSubjects ?? []).flatMap((row) => {
          const teachers = row.teachers ?? [];
          if (teachers.length === 0) {
            return [
              {
                classId: classItem.id,
                className: classItem.class_name,
                classSubjectId: row.id,
                subjectId: row.subject_id,
                subject: subjectLabel(row, subjectFallback),
                assignmentId: `unassigned-${row.id}`,
                teacherId: "",
                teacherName: unassignedLabel,
                unassigned: true,
              },
            ];
          }
          return teachers.map((assignment) => ({
            classId: classItem.id,
            className: classItem.class_name,
            classSubjectId: row.id,
            subjectId: row.subject_id,
            subject: subjectLabel(row, subjectFallback),
            assignmentId: assignment.id,
            teacherId: assignment.teacher_id,
            teacherName: assignmentTeacherName(assignment, teacherFallback),
            unassigned: false,
          }));
        }),
      ),
    [classes, subjectFallback, teacherFallback, unassignedLabel],
  );

  const filteredAssignmentRows = useMemo(
    () =>
      assignmentRows.filter((row) => {
        if (tableClassFilter !== "all" && row.classId !== tableClassFilter) return false;
        if (tableSubjectFilter !== "all" && row.subjectId !== tableSubjectFilter) return false;
        if (tableTeacherFilter === "unassigned") return row.unassigned;
        if (tableTeacherFilter !== "all" && row.teacherId !== tableTeacherFilter) return false;
        return true;
      }),
    [assignmentRows, tableClassFilter, tableSubjectFilter, tableTeacherFilter],
  );

  const tableSubjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assignmentRows.forEach((row) => {
      if (!seen.has(row.subjectId)) seen.set(row.subjectId, row.subject);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [assignmentRows]);

  const tableTeacherOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assignmentRows.forEach((row) => {
      if (row.unassigned) {
        seen.set("unassigned", unassignedLabel);
        return;
      }
      if (!seen.has(row.teacherId)) seen.set(row.teacherId, row.teacherName);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [assignmentRows, unassignedLabel]);

  useEffect(() => {
    if (!selectedClassId) {
      setSelectedCatalogSubjectId("");
      setSelectedClassSubjectId("");
      setSelectedTeacherId("");
      setEditingAssignmentId("");
      return;
    }
    const stillValid = attachedSubjectOptions.some((option) => option.value === selectedClassSubjectId);
    if (!stillValid) {
      setSelectedClassSubjectId("");
      setSelectedTeacherId("");
      setEditingAssignmentId("");
    }
  }, [attachedSubjectOptions, selectedClassId, selectedClassSubjectId]);

  const handleClassChange = (value: string) => {
    setSelectedClassId(value);
    setSelectedCatalogSubjectId("");
    setSelectedClassSubjectId("");
    setSelectedTeacherId("");
    setEditingAssignmentId("");
  };

  const handleAttachSubject = async () => {
    if (!selectedClassId || !selectedCatalogSubjectId) {
      triggerToast({
        title: t("needClassSubjectTitle"),
        description: t("needClassSubject"),
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const catalogSubjectId = selectedCatalogSubjectId;
      const classId = selectedClassId;
      await axiosReq.post(`${baseUrl}/classes/${classId}/subjects`, {
        subject_id: catalogSubjectId,
      });
      setSelectedCatalogSubjectId("");
      triggerToast({
        title: t("subjectAddedTitle"),
        description: t("subjectAdded"),
        type: "success",
      });
      const nextClasses = await load();
      const attached = nextClasses
        .find((item) => item.id === classId)
        ?.classSubjects?.find((row) => row.subject_id === catalogSubjectId);
      if (attached) {
        setSelectedClassSubjectId(attached.id);
        setSelectedTeacherId("");
        setEditingAssignmentId("");
      }
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedClassId || !selectedClassSubjectId || !selectedTeacherId) {
      triggerToast({
        title: t("needAllTitle"),
        description: t("needAll"),
        type: "error",
      });
      return;
    }
    setSaving(true);
    const replacing = Boolean(editingAssignmentId);
    const currentTeacherId = selectedClassSubject?.teachers?.find(
      (assignment) => assignment.id === editingAssignmentId,
    )?.teacher_id;
    try {
      if (replacing && currentTeacherId === selectedTeacherId) {
        setEditingAssignmentId("");
        setSelectedTeacherId("");
        return;
      }
      if (editingAssignmentId) {
        await axiosReq.patch(
          `${baseUrl}/classes/${selectedClassId}/subjects/${selectedClassSubjectId}/teachers/${editingAssignmentId}`,
          { teacher_id: selectedTeacherId },
        );
      } else {
        await axiosReq.post(
          `${baseUrl}/classes/${selectedClassId}/subjects/${selectedClassSubjectId}/teachers`,
          { teacher_id: selectedTeacherId },
        );
      }
      setSelectedTeacherId("");
      setEditingAssignmentId("");
      triggerToast({
        title: replacing ? t("replacedTitle") : t("assignedTitle"),
        description: t("assigned"),
        type: "success",
      });
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (classId: string, classSubjectId: string, assignmentId: string) => {
    setSaving(true);
    try {
      await axiosReq.delete(
        `${baseUrl}/classes/${classId}/subjects/${classSubjectId}/teachers/${assignmentId}`,
      );
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId("");
        setSelectedTeacherId("");
      }
      triggerToast({
        title: t("unassignedTitle"),
        description: t("unassignedDetail"),
        type: "success",
      });
      setPendingRemoval(null);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSubject = async (classId: string, classSubjectId: string) => {
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/classes/${classId}/subjects/${classSubjectId}`);
      if (selectedClassSubjectId === classSubjectId) {
        setSelectedClassSubjectId("");
        setSelectedTeacherId("");
        setEditingAssignmentId("");
      }
      triggerToast({
        title: t("subjectRemovedTitle"),
        description: t("subjectRemoved"),
        type: "success",
      });
      setPendingRemoval(null);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAssignment = (row: (typeof assignmentRows)[number]) => {
    setSelectedClassId(row.classId);
    setSelectedCatalogSubjectId("");
    setSelectedClassSubjectId(row.classSubjectId);
    setSelectedTeacherId(row.teacherId);
    setEditingAssignmentId(row.assignmentId);
    step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  const step1SubjectPlaceholder = !selectedClassId
    ? t("classFirst")
    : attachableSubjectOptions.length === 0
      ? t("allAttached")
      : t("selectSubject");
  const step2SubjectPlaceholder = !selectedClassId
    ? t("classFirst")
    : classSubjects.length === 0
      ? t("addSubjectFirst")
      : t("selectSubject");

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    if (pendingRemoval.kind === "subject") {
      void handleRemoveSubject(pendingRemoval.classId, pendingRemoval.classSubjectId);
    } else {
      void handleUnassign(pendingRemoval.classId, pendingRemoval.classSubjectId, pendingRemoval.assignmentId);
    }
  };

  const columns: TableColumn<(typeof assignmentRows)[number]>[] = [
    { key: "class", header: t("class"), cell: (row) => row.className, sortValue: (row) => row.className },
    { key: "subject", header: t("subject"), cell: (row) => row.subject, sortValue: (row) => row.subject },
    {
      key: "teacher",
      header: t("teacher"),
      cell: (row) => (row.unassigned ? <span className="text-ink-muted">{row.teacherName}</span> : row.teacherName),
      sortValue: (row) => (row.unassigned ? null : row.teacherName),
    },
    {
      key: "actions",
      header: t("remove"),
      align: "right",
      cell: (row) =>
        row.unassigned ? (
          <span className="text-body-sm text-ink-muted">{t("assignInStep2")}</span>
        ) : (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleEditAssignment(row)}>
              {t("edit")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              disabled={saving}
              onClick={() =>
                setPendingRemoval({
                  kind: "teacher",
                  classId: row.classId,
                  className: row.className,
                  classSubjectId: row.classSubjectId,
                  assignmentId: row.assignmentId,
                  subject: row.subject,
                  teacher: row.teacherName,
                })
              }
            >
              {t("remove")}
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={activeOrganization?.name ? `${activeOrganization.name} · ${t("intro")}` : t("intro")} />

      <Card title={t("step1")}>
        <div className="flex flex-col gap-4">
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Combobox label={t("class")} placeholder={t("selectClass")} value={selectedClassId || null} onChange={(value) => handleClassChange(value ?? "")} options={classOptions} />
            <Combobox
              label={t("subject")}
              placeholder={step1SubjectPlaceholder}
              value={selectedCatalogSubjectId || null}
              onChange={(value) => setSelectedCatalogSubjectId(value ?? "")}
              options={attachableSubjectOptions}
              disabled={!selectedClassId}
            />
            <Button loading={saving} onClick={() => void handleAttachSubject()}>
              {t("addSubject")}
            </Button>
          </div>
          {selectedClass ? (
            <div className="flex flex-col gap-2 rounded-input border border-border p-3">
              <p className="text-body-sm font-semibold text-ink">{t("subjectsIn", { name: selectedClass.class_name })}</p>
              {classSubjects.length === 0 ? (
                <p className="text-body-sm text-ink-muted">{t("noSubjects")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {classSubjects.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 rounded-input bg-canvas px-3 py-2">
                      <span className="text-body-sm text-ink">{subjectLabel(row, subjectFallback)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        disabled={saving}
                        onClick={() =>
                          setPendingRemoval({
                            kind: "subject",
                            classId: selectedClass.id,
                            className: selectedClass.class_name,
                            classSubjectId: row.id,
                            subject: subjectLabel(row, subjectFallback),
                          })
                        }
                      >
                        {t("remove")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <div ref={step2Ref} className="scroll-mt-24">
        <Card
          title={t("step2")}
          actions={
            editingAssignmentId ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingAssignmentId("");
                  setSelectedTeacherId("");
                }}
              >
                {t("cancelEdit")}
              </Button>
            ) : undefined
          }
        >
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Combobox label={t("class")} placeholder={t("selectClass")} value={selectedClassId || null} onChange={(value) => handleClassChange(value ?? "")} options={classOptions} />
            <Combobox
              label={t("subject")}
              placeholder={step2SubjectPlaceholder}
              value={selectedClassSubjectId || null}
              onChange={(value) => {
                setSelectedClassSubjectId(value ?? "");
                setSelectedTeacherId("");
                setEditingAssignmentId("");
              }}
              options={attachedSubjectOptions}
              disabled={!selectedClassId || classSubjects.length === 0}
            />
            <Combobox
              label={t("teacher")}
              placeholder={!selectedClassSubjectId ? t("subjectFirst") : t("selectTeacher")}
              value={selectedTeacherId || null}
              onChange={(value) => setSelectedTeacherId(value ?? "")}
              options={selectedClassSubjectId ? teacherOptions : []}
              disabled={!selectedClassSubjectId}
            />
            <Button loading={saving} onClick={() => void handleAssignTeacher()}>
              {editingAssignmentId ? t("replace") : t("assign")}
            </Button>
          </div>
        </Card>
      </div>

      <Card title={t("step3")} flush>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Combobox
            label={t("filterClass")}
            value={tableClassFilter}
            onChange={(value) => setTableClassFilter(value ?? "all")}
            options={[{ label: t("allClasses"), value: "all" }, ...classOptions]}
          />
          <Combobox
            label={t("filterSubject")}
            value={tableSubjectFilter}
            onChange={(value) => setTableSubjectFilter(value ?? "all")}
            options={[{ label: t("allSubjects"), value: "all" }, ...tableSubjectOptions]}
          />
          <Combobox
            label={t("filterTeacher")}
            value={tableTeacherFilter}
            onChange={(value) => setTableTeacherFilter(value ?? "all")}
            options={[{ label: t("allTeachers"), value: "all" }, ...tableTeacherOptions]}
          />
        </div>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table
            caption={t("step3")}
            columns={columns}
            rows={filteredAssignmentRows}
            getRowId={(row) => row.assignmentId}
            empty={<EmptyState title={t("empty")} />}
          />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        tone="danger"
        title={
          pendingRemoval?.kind === "teacher"
            ? t("unassignTitle", { teacher: pendingRemoval.teacher, subject: pendingRemoval.subject })
            : t("removeSubjectTitle", { subject: pendingRemoval?.subject ?? "", className: pendingRemoval?.className ?? "" })
        }
        description={
          pendingRemoval?.kind === "teacher" ? t("unassignDetail", { className: pendingRemoval.className }) : t("removeSubjectDetail")
        }
        confirmLabel={t("remove")}
        loading={saving}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
      />
    </div>
  );
};

const OrganizationAssignments = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN", "ASSISTANT"]}>
    <OrganizationAssignmentsContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationAssignments;
