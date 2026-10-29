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
  Select,
  Skeleton,
  Table,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

const ALL_SECTIONS = "all";

const subjectLabel = (row: ClassSubject, fallback: string) =>
  row.subject?.code ? `${row.subject.name} — ${row.subject.code}` : row.subject?.name || fallback;

const offeringSubjectLabel = (offering: SubjectClass) =>
  offering.subject.code ? `${offering.subject.name} — ${offering.subject.code}` : offering.subject.name;

const catalogSubjectLabel = (subject: OrganizationSubjectItem) => (subject.code ? `${subject.name} — ${subject.code}` : subject.name);

const teacherLabel = (member: OrganizationMemberItem, fallback: string) => member.user.full_name || member.user.phone || fallback;

type AssignmentRow = {
  key: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  offering: SubjectClass;
  subjectId: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  unassigned: boolean;
};

type PendingRemoval =
  | { kind: "subject"; classId: string; className: string; classSubjectId: string; subject: string }
  | { kind: "teacher"; row: AssignmentRow };

type Loaded = {
  classes: Class[];
  catalog: OrganizationSubjectItem[];
  teachers: OrganizationMemberItem[];
  sessions: AcademicSession[];
  sections: ClassSection[];
  offerings: SubjectClass[];
  sessionId: string;
};

const EMPTY: Loaded = { classes: [], catalog: [], teachers: [], sessions: [], sections: [], offerings: [], sessionId: "" };

/**
 * Which subjects each class has (step 1), and who teaches each subject in each section (steps 2–3,
 * P2-03 part 3b). Teachers belong to subject classes (section + subject); "All sections" assigns a
 * teacher to the subject in every section of the class at once.
 */
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
  const [data, setData] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  /** The row being changed ("Change"): its teacher is replaced in that subject class. */
  const [replacing, setReplacing] = useState<AssignmentRow | null>(null);
  const [tableClassFilter, setTableClassFilter] = useState("all");
  const [tableSubjectFilter, setTableSubjectFilter] = useState("all");
  const [tableTeacherFilter, setTableTeacherFilter] = useState("all");
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);

  /** Classes, the subject catalogue, teachers, and the sections and subject classes of a session (default first). */
  const fetchAll = useCallback(
    async (sessionId?: string): Promise<Loaded> => {
      if (!organizationId) return EMPTY;
      try {
        const [classRes, catalogRes, teacherRes, sessionRes] = await Promise.all([
          axiosReq.get<ApiResponse<Class[]>>(`${baseUrl}/classes`),
          axiosReq.get<ApiResponse<OrganizationSubjectItem[]>>(`${baseUrl}/organizations/${organizationId}/subjects`),
          axiosReq.get<ApiResponse<OrganizationMemberItem[]>>(`${baseUrl}/organizations/${organizationId}/assignable-teachers`),
          axiosReq.get<ApiResponse<AcademicSession[]>>(`${baseUrl}/sessions`),
        ]);
        const sessions = sessionRes.data?.payload ?? [];
        const chosen = sessionId || (sessions.find((s) => s.is_default) ?? sessions[0])?.id || "";
        const query = chosen ? `?session_id=${chosen}` : "";
        const [sectionRes, offeringRes] = await Promise.all([
          axiosReq.get<ApiResponse<ClassSection[]>>(`${baseUrl}/sections${query}`),
          axiosReq.get<ApiResponse<SubjectClass[]>>(`${baseUrl}/offerings${query}`),
        ]);
        return {
          classes: classRes.data?.payload ?? [],
          catalog: catalogRes.data?.payload ?? [],
          teachers: teacherRes.data?.payload ?? [],
          sessions,
          sections: sectionRes.data?.payload ?? [],
          offerings: offeringRes.data?.payload ?? [],
          sessionId: chosen,
        };
      } catch (error) {
        handleError(error as AxiosError<ApiError>);
        return EMPTY;
      }
    },
    [baseUrl, handleError, organizationId],
  );

  useEffect(() => {
    void fetchAll().then(setData);
  }, [fetchAll]);

  const reload = useCallback(async () => {
    const next = await fetchAll(data?.sessionId);
    setData(next);
    return next;
  }, [data?.sessionId, fetchAll]);

  const loaded = data ?? EMPTY;
  const { classes, catalog, teachers, sessions, sections, offerings } = loaded;
  const session = sessions.find((s) => s.id === loaded.sessionId);
  const sessionOpen = session?.status !== "CLOSED";

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const classOptions = useMemo(() => classes.map((item) => ({ label: item.class_name, value: item.id })), [classes]);

  // Step 1: the class's subjects.
  const selectedClass = classById.get(selectedClassId);
  const classSubjects = useMemo(() => selectedClass?.classSubjects ?? [], [selectedClass]);
  const attachableSubjectOptions = useMemo(() => {
    const attachedIds = new Set(classSubjects.map((row) => row.subject_id));
    return catalog.filter((subject) => !attachedIds.has(subject.id)).map((subject) => ({ label: catalogSubjectLabel(subject), value: subject.id }));
  }, [catalog, classSubjects]);

  // Step 2: section(s) of the class, then a subject taught there, then a teacher.
  const classSections = useMemo(
    () => sections.filter((s) => s.class_id === selectedClassId).sort((a, b) => a.name.localeCompare(b.name)),
    [sections, selectedClassId],
  );
  const targetSectionIds = useMemo(
    () => (selectedSectionId === ALL_SECTIONS ? classSections.map((s) => s.id) : selectedSectionId ? [selectedSectionId] : []),
    [classSections, selectedSectionId],
  );
  const subjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    offerings
      .filter((o) => targetSectionIds.includes(o.section_id))
      .forEach((o) => seen.set(o.subject.id, offeringSubjectLabel(o)));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [offerings, targetSectionIds]);
  const targets = useMemo(
    () =>
      replacing
        ? [replacing.offering]
        : offerings.filter((o) => targetSectionIds.includes(o.section_id) && o.subject.id === selectedSubjectId),
    [offerings, replacing, selectedSubjectId, targetSectionIds],
  );
  const teacherOptions = useMemo(
    () =>
      teachers
        // Not offered when they already teach every target (they would change nothing).
        .filter((member) => replacing || !targets.every((o) => o.teachers.some((p) => p.id === member.user.id)))
        .map((member) => ({ label: teacherLabel(member, teacherFallback), value: member.user.id })),
    [replacing, targets, teacherFallback, teachers],
  );

  // Step 3: one row per subject class and teacher (or an "unassigned" row).
  const assignmentRows = useMemo<AssignmentRow[]>(
    () =>
      offerings.flatMap((offering): AssignmentRow[] => {
        const section = sectionById.get(offering.section_id);
        const classItem = section ? classById.get(section.class_id) : undefined;
        if (!section || !classItem) return [];
        const base = {
          classId: classItem.id,
          className: classItem.class_name,
          sectionId: section.id,
          sectionName: section.name,
          offering,
          subjectId: offering.subject.id,
          subject: offeringSubjectLabel(offering),
        };
        if (offering.teachers.length === 0) {
          return [{ ...base, key: `unassigned-${offering.id}`, teacherId: "", teacherName: unassignedLabel, unassigned: true }];
        }
        return offering.teachers.map((teacher) => ({
          ...base,
          key: `${offering.id}-${teacher.id}`,
          teacherId: teacher.id,
          teacherName: teacher.full_name || teacherFallback,
          unassigned: false,
        }));
      }),
    [classById, offerings, sectionById, teacherFallback, unassignedLabel],
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
    assignmentRows.forEach((row) => seen.set(row.subjectId, row.subject));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [assignmentRows]);

  const tableTeacherOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assignmentRows.forEach((row) => seen.set(row.unassigned ? "unassigned" : row.teacherId, row.teacherName));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [assignmentRows]);

  const clearStep2 = () => {
    setSelectedSectionId("");
    setSelectedSubjectId("");
    setSelectedTeacherId("");
    setReplacing(null);
  };

  const handleClassChange = (value: string) => {
    setSelectedClassId(value);
    setSelectedCatalogSubjectId("");
    clearStep2();
  };

  const handleSessionChange = async (sessionId: string) => {
    clearStep2();
    setData(await fetchAll(sessionId));
  };

  /** Sets the teachers of a subject class: everyone already there, minus `remove`, plus `add`. */
  const setTeachersOf = (offering: SubjectClass, { add, remove }: { add?: string; remove?: string }) => {
    const ids = offering.teachers.map((p) => p.id).filter((id) => id !== remove);
    if (add && !ids.includes(add)) ids.push(add);
    return axiosReq.put(`${baseUrl}/offerings/${offering.id}/teachers`, { teacher_ids: ids });
  };

  const handleAttachSubject = async () => {
    if (!selectedClassId || !selectedCatalogSubjectId) {
      triggerToast({ title: t("needClassSubjectTitle"), description: t("needClassSubject"), type: "error" });
      return;
    }
    setSaving(true);
    try {
      await axiosReq.post(`${baseUrl}/classes/${selectedClassId}/subjects`, { subject_id: selectedCatalogSubjectId });
      const subjectId = selectedCatalogSubjectId;
      setSelectedCatalogSubjectId("");
      triggerToast({ title: t("subjectAddedTitle"), description: t("subjectAdded"), type: "success" });
      await reload();
      // Continue in step 2 with the new subject in every section of the class.
      setSelectedSectionId(ALL_SECTIONS);
      setSelectedSubjectId(subjectId);
      setSelectedTeacherId("");
      setReplacing(null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacherId || targets.length === 0) {
      triggerToast({ title: t("needAllTitle"), description: t("needAll"), type: "error" });
      return;
    }
    if (replacing && replacing.teacherId === selectedTeacherId) {
      clearStep2();
      return;
    }
    setSaving(true);
    try {
      for (const offering of targets) {
        await setTeachersOf(offering, { add: selectedTeacherId, remove: replacing?.teacherId });
      }
      triggerToast({ title: replacing ? t("replacedTitle") : t("assignedTitle"), description: t("assigned"), type: "success" });
      clearStep2();
      await reload();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (row: AssignmentRow) => {
    setSaving(true);
    try {
      await setTeachersOf(row.offering, { remove: row.teacherId });
      if (replacing?.key === row.key) clearStep2();
      triggerToast({ title: t("unassignedTitle"), description: t("unassignedDetail"), type: "success" });
      setPendingRemoval(null);
      await reload();
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
      clearStep2();
      triggerToast({ title: t("subjectRemovedTitle"), description: t("subjectRemoved"), type: "success" });
      setPendingRemoval(null);
      await reload();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAssignment = (row: AssignmentRow) => {
    setSelectedClassId(row.classId);
    setSelectedCatalogSubjectId("");
    setSelectedSectionId(row.sectionId);
    setSelectedSubjectId(row.subjectId);
    setSelectedTeacherId(row.teacherId);
    setReplacing(row);
    step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    if (pendingRemoval.kind === "subject") {
      void handleRemoveSubject(pendingRemoval.classId, pendingRemoval.classSubjectId);
    } else {
      void handleUnassign(pendingRemoval.row);
    }
  };

  const step1SubjectPlaceholder = !selectedClassId ? t("classFirst") : attachableSubjectOptions.length === 0 ? t("allAttached") : t("selectSubject");
  const sectionPlaceholder = !selectedClassId ? t("classFirst") : classSections.length === 0 ? t("noSections") : t("selectSection");
  const subjectPlaceholder = !selectedSectionId ? t("sectionFirst") : subjectOptions.length === 0 ? t("addSubjectFirst") : t("selectSubject");
  const sectionOptions = [
    ...(classSections.length > 1 ? [{ value: ALL_SECTIONS, label: t("allSections") }] : []),
    ...classSections.map((s) => ({ value: s.id, label: s.name })),
  ];

  const columns: TableColumn<AssignmentRow>[] = [
    { key: "class", header: t("class"), cell: (row) => row.className, sortValue: (row) => row.className },
    { key: "section", header: t("section"), cell: (row) => row.sectionName, sortValue: (row) => row.sectionName },
    { key: "subject", header: t("subject"), cell: (row) => row.subject, sortValue: (row) => row.subject },
    {
      key: "teacher",
      header: t("teacher"),
      cell: (row) => (row.unassigned ? <span className="text-ink-muted">{row.teacherName}</span> : row.teacherName),
      sortValue: (row) => (row.unassigned ? null : row.teacherName),
    },
    ...(sessionOpen
      ? [
          {
            key: "actions",
            header: t("remove"),
            align: "right" as const,
            cell: (row: AssignmentRow) =>
              row.unassigned ? (
                <span className="text-body-sm text-ink-muted">{t("assignInStep2")}</span>
              ) : (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleEditAssignment(row)}>
                    {t("edit")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" disabled={saving} onClick={() => setPendingRemoval({ kind: "teacher", row })}>
                    {t("remove")}
                  </Button>
                </div>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={activeOrganization?.name ? `${activeOrganization.name} · ${t("intro")}` : t("intro")}
        actions={
          sessions.length > 1 ? (
            <Select
              label={t("session")}
              placeholder={false}
              value={loaded.sessionId}
              options={sessions.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(e) => void handleSessionChange(e.target.value)}
            />
          ) : undefined
        }
      />

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
            replacing ? (
              <Button size="sm" variant="ghost" onClick={clearStep2}>
                {t("cancelEdit")}
              </Button>
            ) : undefined
          }
        >
          {sessionOpen ? (
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Combobox label={t("class")} placeholder={t("selectClass")} value={selectedClassId || null} onChange={(value) => handleClassChange(value ?? "")} options={classOptions} disabled={Boolean(replacing)} />
              <Combobox
                label={t("section")}
                placeholder={sectionPlaceholder}
                value={selectedSectionId || null}
                onChange={(value) => {
                  setSelectedSectionId(value ?? "");
                  setSelectedSubjectId("");
                  setSelectedTeacherId("");
                }}
                options={sectionOptions}
                disabled={!selectedClassId || classSections.length === 0 || Boolean(replacing)}
              />
              <Combobox
                label={t("subject")}
                placeholder={subjectPlaceholder}
                value={selectedSubjectId || null}
                onChange={(value) => {
                  setSelectedSubjectId(value ?? "");
                  setSelectedTeacherId("");
                }}
                options={subjectOptions}
                disabled={!selectedSectionId || subjectOptions.length === 0 || Boolean(replacing)}
              />
              <Combobox
                label={t("teacher")}
                placeholder={!selectedSubjectId ? t("subjectFirst") : t("selectTeacher")}
                value={selectedTeacherId || null}
                onChange={(value) => setSelectedTeacherId(value ?? "")}
                options={selectedSubjectId ? teacherOptions : []}
                disabled={!selectedSubjectId}
              />
              <Button loading={saving} onClick={() => void handleAssignTeacher()}>
                {replacing ? t("replace") : t("assign")}
              </Button>
            </div>
          ) : (
            <p className="text-body-sm text-ink-muted">{t("sessionClosed")}</p>
          )}
        </Card>
      </div>

      <Card title={t("step3")} flush>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Combobox label={t("filterClass")} value={tableClassFilter} onChange={(value) => setTableClassFilter(value ?? "all")} options={[{ label: t("allClasses"), value: "all" }, ...classOptions]} />
          <Combobox label={t("filterSubject")} value={tableSubjectFilter} onChange={(value) => setTableSubjectFilter(value ?? "all")} options={[{ label: t("allSubjects"), value: "all" }, ...tableSubjectOptions]} />
          <Combobox label={t("filterTeacher")} value={tableTeacherFilter} onChange={(value) => setTableTeacherFilter(value ?? "all")} options={[{ label: t("allTeachers"), value: "all" }, ...tableTeacherOptions]} />
        </div>
        {data === null ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table caption={t("step3")} columns={columns} rows={filteredAssignmentRows} getRowId={(row) => row.key} empty={<EmptyState title={t("empty")} />} />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        tone="danger"
        title={
          pendingRemoval?.kind === "teacher"
            ? t("unassignTitle", { teacher: pendingRemoval.row.teacherName, subject: pendingRemoval.row.subject })
            : t("removeSubjectTitle", { subject: pendingRemoval?.subject ?? "", className: pendingRemoval?.className ?? "" })
        }
        description={
          pendingRemoval?.kind === "teacher"
            ? t("unassignDetail", { className: `${pendingRemoval.row.className} · ${pendingRemoval.row.sectionName}` })
            : t("removeSubjectDetail")
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
