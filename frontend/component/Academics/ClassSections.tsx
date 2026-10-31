"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconButton,
  Select,
  Skeleton,
  Table,
  Tabs,
  type TableColumn,
} from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import EditSquareIconSVG from "../svg/EditSquareIconSVG";
import TrashIcon from "../svg/TrashIcon";
import SectionFormDrawer from "./SectionFormDrawer";
import StudentImportDrawer from "./StudentImportDrawer";
import SectionStudents from "./SectionStudents";
import SectionSubjects from "./SectionSubjects";

/**
 * The sections of a class in a session (FND-02), each with its students (FND-04) and subject
 * classes (FND-19). Owners, admins and assistants (and a solo teacher) change them; other staff read.
 */
const ClassSections = ({ classId }: { classId: string }) => {
  const t = useTranslations("academics.sections");
  const tImport = useTranslations("academics.import");
  const format = useFormat();
  const { baseUrl, run, canManageStructure, isIndividual, organizationId } = useAcademicsRequest();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [classTeacherEnabled, setClassTeacherEnabled] = useState(false);
  const [teachers, setTeachers] = useState<AcademicPerson[]>([]);
  const [editing, setEditing] = useState<ClassSection | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClassSection | null>(null);
  const [importing, setImporting] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  // Sessions, settings and teachers once; sections whenever the session changes.
  useEffect(() => {
    void run(() => axiosReq.get<ApiResponse<AcademicSession[]>>(`${baseUrl}/sessions`)).then((res) => {
      const list = res?.data?.payload ?? [];
      setSessions(list);
      setSessionId((list.find((s) => s.is_default) ?? list[0])?.id ?? "");
    });
  }, [baseUrl, run]);

  useEffect(() => {
    // A solo teacher's workspace has no class teachers and no other teachers to assign.
    if (isIndividual || !organizationId) return;
    void run(() => axiosReq.get<ApiResponse<OrganizationSettings>>(`${baseUrl}/organizations/${organizationId}/settings`)).then((res) =>
      setClassTeacherEnabled(Boolean(res?.data?.payload?.class_teacher_enabled)),
    );
    if (canManageStructure) {
      void run(() => axiosReq.get<ApiResponse<OrganizationMemberItem[]>>(`${baseUrl}/organizations/${organizationId}/assignable-teachers`)).then(
        (res) => setTeachers((res?.data?.payload ?? []).map((m) => ({ id: m.user.id, full_name: m.user.full_name || m.user.phone || m.user.id }))),
      );
    }
  }, [baseUrl, canManageStructure, isIndividual, organizationId, run]);

  // Sections of the chosen session, remembered with that session so a switch shows a skeleton.
  const [loaded, setLoaded] = useState<{ sessionId: string; sections: ClassSection[] } | null>(null);
  const fetchSections = useCallback(
    () =>
      run(() => axiosReq.get<ApiResponse<ClassSection[]>>(`${baseUrl}/classes/${classId}/sections?session_id=${sessionId}`)).then((res) => ({
        sessionId,
        sections: res?.data?.payload ?? [],
      })),
    [baseUrl, classId, run, sessionId],
  );
  const loadSections = useCallback(() => void fetchSections().then(setLoaded), [fetchSections]);

  useEffect(() => {
    if (sessionId) void fetchSections().then(setLoaded);
  }, [fetchSections, sessionId]);
  const sections = loaded?.sessionId === sessionId ? loaded.sections : null;

  const session = sessions.find((s) => s.id === sessionId);
  const editable = canManageStructure && session?.status === "ACTIVE";
  const openSection = sections?.find((s) => s.id === openSectionId) ?? null;

  const remove = async (section: ClassSection) => {
    setDeleting(null);
    if (await run(() => axiosReq.delete(`${baseUrl}/sections/${section.id}`), t("deleted"))) loadSections();
  };

  const details = (row: ClassSection) =>
    [row.shift ? t(`shifts.${row.shift}`) : null, row.room].filter(Boolean).join(" · ") || "—";

  const columns: TableColumn<ClassSection>[] = [
    {
      key: "name",
      header: t("name"),
      sortValue: (row) => row.name,
      cell: (row) => (
        <Button variant="ghost" size="sm" aria-label={t("open", { name: row.name })} onClick={() => setOpenSectionId(row.id)}>
          {row.name}
        </Button>
      ),
    },
    { key: "details", header: `${t("shift")} · ${t("room")}`, cell: details, hideOnMobile: true },
    ...(classTeacherEnabled
      ? [{ key: "classTeacher", header: t("classTeacher"), cell: (row: ClassSection) => row.class_teacher?.full_name ?? "—" }]
      : []),
    {
      key: "students",
      header: t("tabs.students"),
      align: "right",
      sortValue: (row) => row.student_count,
      cell: (row) => t("studentCount", { count: row.student_count }),
    },
    ...(editable
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (row: ClassSection) => (
              <div className="flex justify-end gap-1">
                <IconButton size="sm" label={t("editFor", { name: row.name })} icon={<EditSquareIconSVG />} onClick={() => setEditing(row)} />
                <IconButton size="sm" label={t("deleteFor", { name: row.name })} icon={<TrashIcon />} className="text-danger" onClick={() => setDeleting(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card
      title={t("title")}
      actions={
        editable ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
              {tImport("open")}
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              {t("add")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {sessions.length > 1 ? (
          <Select
            label={t("session")}
            placeholder={false}
            value={sessionId}
            fieldClassName="sm:max-w-xs"
            options={sessions.map((s) => ({ value: s.id, label: `${s.name} (${format.date(s.start_date)} – ${format.date(s.end_date)})` }))}
            onChange={(e) => setSessionId(e.target.value)}
          />
        ) : null}
        {session?.status === "CLOSED" ? <p className="text-body-sm text-ink-muted">{t("closedSession")}</p> : null}

        {sections === null ? (
          <Skeleton lines={3} />
        ) : sections.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <Table caption={t("title")} columns={columns} rows={sections} getRowId={(row) => row.id} defaultSort={{ key: "name", direction: "asc" }} />
        )}
      </div>

      {importing && sessionId ? (
        <StudentImportDrawer classId={classId} sessionId={sessionId} onClose={() => setImporting(false)} onImported={loadSections} />
      ) : null}

      {editing !== null ? (
        <SectionFormDrawer
          key={editing === "new" ? "new" : editing.id}
          classId={classId}
          sessionId={sessionId}
          section={editing === "new" ? null : editing}
          teachers={teachers}
          classTeacherEnabled={classTeacherEnabled}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadSections();
          }}
        />
      ) : null}

      <Drawer open={Boolean(openSection)} onClose={() => setOpenSectionId(null)} title={openSection ? t("sectionTitle", { name: openSection.name }) : ""} wide>
        {openSection ? (
          <Tabs
            tabs={[
              {
                key: "students",
                label: t("tabs.students"),
                content: <SectionStudents section={openSection} sections={sections ?? []} editable={editable} onChanged={loadSections} />,
              },
              {
                key: "subjects",
                label: t("tabs.subjects"),
                content: (
                  <SectionSubjects classId={classId} section={openSection} teachers={teachers} editable={editable} canEditTeachers={editable && !isIndividual} />
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={deleting ? t("deleteTitle", { name: deleting.name }) : ""}
        description={t("deleteDetail")}
        confirmLabel={t("deleteConfirm")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
    </Card>
  );
};

export default ClassSections;
