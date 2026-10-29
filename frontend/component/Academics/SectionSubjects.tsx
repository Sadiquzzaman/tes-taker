"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Combobox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Modal,
  Select,
  Skeleton,
  Table,
  type TableColumn,
} from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";
import CrossIconSVG from "../svg/CrossIconSVG";
import EditSquareIconSVG from "../svg/EditSquareIconSVG";
import TrashIcon from "../svg/TrashIcon";

const subjectName = (offering: SubjectClass) =>
  offering.subject.code ? `${offering.subject.name} (${offering.subject.code})` : offering.subject.name;

/**
 * The subject classes of a section (FND-19): who teaches each subject, and for optional subjects
 * (religion, electives) which students take it. Subjects come from the class's subject list.
 */
const SectionSubjects = ({
  classId,
  section,
  teachers,
  editable,
  canEditTeachers,
}: {
  classId: string;
  section: ClassSection;
  /** Teaching members who can be assigned (empty in a solo workspace). */
  teachers: AcademicPerson[];
  editable: boolean;
  canEditTeachers: boolean;
}) => {
  const t = useTranslations("academics.subjects");
  const { baseUrl, run } = useAcademicsRequest();
  const [offerings, setOfferings] = useState<SubjectClass[] | null>(null);
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [newSubjectId, setNewSubjectId] = useState("");
  const [removing, setRemoving] = useState<SubjectClass | null>(null);
  const [editing, setEditing] = useState<SubjectClass | null>(null);
  const [draftTeachers, setDraftTeachers] = useState<AcademicPerson[]>([]);
  const [draftSelected, setDraftSelected] = useState(false);
  const [draftStudents, setDraftStudents] = useState<string[]>([]);
  const [activeStudents, setActiveStudents] = useState<SectionEnrolment[]>([]);
  const [saving, setSaving] = useState(false);

  /** The section's subject classes and, for optional ones, how many students take them. */
  const fetchOfferings = useCallback(async () => {
    const res = await run(() => axiosReq.get<ApiResponse<SubjectClass[]>>(`${baseUrl}/sections/${section.id}/offerings`));
    const list = res?.data?.payload ?? [];
    const counts: Record<string, number> = {};
    for (const offering of list.filter((o) => o.enrolment_mode === "SELECTED")) {
      const roster = await run(() => axiosReq.get<ApiResponse<RosterStudent[]>>(`${baseUrl}/offerings/${offering.id}/roster`));
      counts[offering.id] = roster?.data?.payload?.length ?? 0;
    }
    return { list, counts };
  }, [baseUrl, run, section.id]);
  const apply = useCallback(({ list, counts }: { list: SubjectClass[]; counts: Record<string, number> }) => {
    setOfferings(list);
    setSelectedCounts(counts);
  }, []);
  const load = useCallback(() => void fetchOfferings().then(apply), [apply, fetchOfferings]);

  useEffect(() => {
    void fetchOfferings().then(apply);
  }, [apply, fetchOfferings]);

  useEffect(() => {
    if (!editable) return;
    void run(() => axiosReq.get<ApiResponse<ClassSubject[]>>(`${baseUrl}/classes/${classId}/subjects`)).then((res) =>
      setClassSubjects(res?.data?.payload ?? []),
    );
  }, [baseUrl, classId, editable, run]);

  const missing = classSubjects.filter((cs) => !(offerings ?? []).some((o) => o.subject.id === cs.subject_id));

  const add = async () => {
    if (await run(() => axiosReq.post(`${baseUrl}/sections/${section.id}/offerings`, { subject_id: newSubjectId }), t("added"))) {
      setNewSubjectId("");
      load();
    }
  };

  const remove = async (offering: SubjectClass) => {
    setRemoving(null);
    if (await run(() => axiosReq.delete(`${baseUrl}/offerings/${offering.id}`), t("removed"))) load();
  };

  const openEditor = async (offering: SubjectClass) => {
    setEditing(offering);
    setDraftTeachers(offering.teachers);
    setDraftSelected(offering.enrolment_mode === "SELECTED");
    const [enrolments, roster] = await Promise.all([
      run(() => axiosReq.get<ApiResponse<SectionEnrolment[]>>(`${baseUrl}/sections/${section.id}/enrolments`)),
      offering.enrolment_mode === "SELECTED"
        ? run(() => axiosReq.get<ApiResponse<RosterStudent[]>>(`${baseUrl}/offerings/${offering.id}/roster`))
        : Promise.resolve(null),
    ]);
    setActiveStudents((enrolments?.data?.payload ?? []).filter((row) => row.status === "ACTIVE" && row.student));
    setDraftStudents((roster?.data?.payload ?? []).map((row) => row.student_id));
  };

  const saveEditor = async () => {
    if (!editing) return;
    setSaving(true);
    const steps: Array<() => Promise<unknown>> = [];
    if (canEditTeachers) {
      steps.push(() => axiosReq.put(`${baseUrl}/offerings/${editing.id}/teachers`, { teacher_ids: draftTeachers.map((p) => p.id) }));
    }
    const mode: OfferingEnrolmentMode = draftSelected ? "SELECTED" : "WHOLE_SECTION";
    if (mode !== editing.enrolment_mode) {
      steps.push(() => axiosReq.patch(`${baseUrl}/offerings/${editing.id}`, { enrolment_mode: mode, is_optional: draftSelected }));
    }
    if (draftSelected) {
      steps.push(() => axiosReq.put(`${baseUrl}/offerings/${editing.id}/students`, { student_ids: draftStudents }));
    }
    const saved = await run(async () => {
      for (const step of steps) await step();
      return true;
    }, t("saved"));
    setSaving(false);
    if (saved) {
      setEditing(null);
      load();
    }
  };

  const columns: TableColumn<SubjectClass>[] = [
    { key: "subject", header: t("subject"), cell: subjectName, sortValue: subjectName },
    {
      key: "teachers",
      header: t("teachers"),
      cell: (row) =>
        row.teachers.length ? row.teachers.map((p) => p.full_name).join(", ") : <span className="text-ink-muted">{t("noTeacher")}</span>,
    },
    {
      key: "takenBy",
      header: t("takenBy"),
      cell: (row) =>
        row.enrolment_mode === "SELECTED" ? (
          <Badge tone="info">{t("selected", { count: selectedCounts[row.id] ?? 0 })}</Badge>
        ) : (
          t("whole")
        ),
    },
    ...(editable
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (row: SubjectClass) => (
              <div className="flex justify-end gap-1">
                <IconButton size="sm" label={t("editFor", { name: subjectName(row) })} icon={<EditSquareIconSVG />} onClick={() => void openEditor(row)} />
                <IconButton size="sm" label={t("removeFor", { name: subjectName(row) })} icon={<TrashIcon />} className="text-danger" onClick={() => setRemoving(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  const teacherOptions = teachers
    .filter((teacher) => !draftTeachers.some((p) => p.id === teacher.id))
    .map((teacher) => ({ value: teacher.id, label: teacher.full_name }));

  return (
    <div className="flex flex-col gap-4">
      {editable ? (
        missing.length ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label={t("subject")}
              value={newSubjectId}
              fieldClassName="flex-1"
              options={missing.map((cs) => ({ value: cs.subject_id, label: cs.subject?.name ?? cs.subject_id }))}
              onChange={(e) => setNewSubjectId(e.target.value)}
            />
            <Button disabled={!newSubjectId} onClick={() => void add()}>
              {t("add")}
            </Button>
          </div>
        ) : offerings && offerings.length ? (
          <p className="text-body-sm text-ink-muted">{t("allAdded")}</p>
        ) : null
      ) : null}

      {offerings === null ? (
        <Skeleton lines={4} />
      ) : offerings.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table caption={section.name} columns={columns} rows={offerings} getRowId={(row) => row.id} />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? t("editTitle", { name: subjectName(editing) }) : ""}
        footer={
          <Button onClick={() => void saveEditor()} loading={saving}>
            {t("save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          {canEditTeachers ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-body-sm font-semibold text-ink">{t("teachersLabel")}</h3>
              <p className="text-caption text-ink-muted">{t("teachersHint")}</p>
              <ul className="flex flex-wrap gap-2">
                {draftTeachers.map((teacher) => (
                  <li key={teacher.id} className="flex items-center gap-1 rounded-input bg-primary-soft py-1 pl-3 pr-1 text-body-sm text-primary">
                    {teacher.full_name}
                    <IconButton
                      size="sm"
                      label={t("removeTeacher", { name: teacher.full_name })}
                      icon={<CrossIconSVG />}
                      onClick={() => setDraftTeachers(draftTeachers.filter((p) => p.id !== teacher.id))}
                    />
                  </li>
                ))}
              </ul>
              <Combobox
                label={t("addTeacher")}
                value={null}
                options={teacherOptions}
                onChange={(id) => {
                  const teacher = teachers.find((p) => p.id === id);
                  if (teacher) setDraftTeachers([...draftTeachers, teacher]);
                }}
              />
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <Checkbox label={t("selectedOnly")} checked={draftSelected} onChange={(e) => setDraftSelected(e.target.checked)} />
            {draftSelected ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-body-sm font-semibold text-ink">{t("pickStudents")}</legend>
                {activeStudents.length === 0 ? (
                  <p className="text-body-sm text-ink-muted">{t("noActiveStudents")}</p>
                ) : (
                  activeStudents.map((row) => {
                    const studentId = row.student?.id ?? "";
                    return (
                      <Checkbox
                        key={row.id}
                        label={row.roll_no ? `${row.roll_no} · ${row.student?.full_name}` : row.student?.full_name}
                        checked={draftStudents.includes(studentId)}
                        onChange={(e) =>
                          setDraftStudents(e.target.checked ? [...draftStudents, studentId] : draftStudents.filter((id) => id !== studentId))
                        }
                      />
                    );
                  })
                )}
              </fieldset>
            ) : null}
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        tone="danger"
        title={removing ? t("removeTitle", { name: subjectName(removing) }) : ""}
        description={t("removeDetail")}
        confirmLabel={t("removeConfirm")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
      />
    </div>
  );
};

export default SectionSubjects;
