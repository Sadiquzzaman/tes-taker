"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  IconButton,
  Modal,
  Select,
  StatusPill,
  Table,
  type TableColumn,
} from "@/design/ui";
import useClassStudent from "@/hooks/classes/useClassStudent";
import useFormat from "@/i18n/useFormat";
import { setOpenAddStudentModal } from "@/lib/features/classSlice";
import { useAppDispatch } from "@/lib/hooks";
import { getClassStudentContact, getClassStudentDisplayName } from "@/utils/classes/classStudentDisplay";
import CrossIconSVG from "../svg/CrossIconSVG";
import EyeIconSVG from "../svg/EyeIconSVG";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import TickSignIconSVG from "../svg/TickSignIconSVG";
import TrashIcon from "../svg/TrashIcon";
import AddStudentModal from "./AddStudentModal";

/** The class roster: students waiting for approval, then members. Teachers approve, view and remove. */
const ClassStudent = ({
  student,
  classId,
  fetch,
  role,
}: {
  student: ClassDetailsStudentItem[];
  classId: string;
  fetch: () => void;
  role: RoleUserType | undefined;
}) => {
  const t = useTranslations("classes.roster");
  const tc = useTranslations("classes");
  const format = useFormat();
  const dispatch = useAppDispatch();
  const isTeacher = role === "TEACHER";
  // Sections of the class's current students (P2-03); the filter appears once there are two or more.
  const sections = [
    ...new Map(
      student.flatMap((item): Array<[string, string]> =>
        "student_id" in item && item.section ? [[item.section.id, item.section.name]] : [],
      ),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const [sectionFilter, setSectionFilter] = useState("");
  const inSection = sectionFilter
    ? student.filter((item) => "student_id" in item && item.section?.id === sectionFilter)
    : student;
  const { searchStudentInput, setSearchStudentInput, filteredStudent, handleRemoveStudent, handleApproveStudent } =
    useClassStudent({ student: inSection, classId, fetch, role });
  const [viewing, setViewing] = useState<ClassStudent | null>(null);
  const [removing, setRemoving] = useState<ClassStudent | null>(null);
  const nameOf = (item: ClassStudent) =>
    getClassStudentDisplayName(item, { invited: t("invitedStudent"), withId: (id) => t("studentWithId", { id }) });

  const sectionColumn: TableColumn<ClassStudent> = {
    key: "section",
    header: t("section"),
    cell: (row) => row.section?.name ?? "—",
    sortValue: (row) => row.section?.name ?? "",
    hideOnMobile: true,
  };

  const pendingColumns: TableColumn<ClassStudent>[] = [
    { key: "name", header: t("student"), cell: nameOf, sortValue: nameOf },
    sectionColumn,
    { key: "contact", header: t("contact"), cell: (row) => getClassStudentContact(row) },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <IconButton size="sm" label={t("approve", { name: nameOf(row) })} icon={<TickSignIconSVG />} className="text-primary" onClick={() => handleApproveStudent(row.student_id)} />
          <IconButton size="sm" label={t("reject", { name: nameOf(row) })} icon={<CrossIconSVG />} className="text-danger" onClick={() => setRemoving(row)} />
        </div>
      ),
    },
  ];

  const memberColumns: TableColumn<ClassStudent>[] = [
    { key: "name", header: t("student"), cell: nameOf, sortValue: nameOf },
    sectionColumn,
    { key: "contact", header: t("contact"), cell: (row) => getClassStudentContact(row) },
    {
      key: "status",
      header: t("status"),
      cell: (row) =>
        row.status === "JOINED" ? <StatusPill tone="success">{t("joined")}</StatusPill> : <StatusPill tone="warning">{t("invited")}</StatusPill>,
      sortValue: (row) => row.status,
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <IconButton size="sm" label={t("view", { name: nameOf(row) })} icon={<EyeIconSVG />} onClick={() => setViewing(row)} />
          <IconButton size="sm" label={t("remove", { name: nameOf(row) })} icon={<TrashIcon />} className="text-danger" onClick={() => setRemoving(row)} />
        </div>
      ),
    },
  ];

  const classmateColumns: TableColumn<StudentClassmate>[] = [
    { key: "name", header: t("student"), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "joined", header: t("joinedSince"), cell: (row) => format.date(row.joined_at), sortValue: (row) => new Date(row.joined_at), align: "right" },
  ];

  const noStudents = student.length === 0;

  return (
    <Card
      title={t("title")}
      actions={
        isTeacher ? (
          <Button size="sm" leftIcon={<HumanAddIconSVG width={16} />} onClick={() => dispatch(setOpenAddStudentModal({ id: classId }))}>
            {tc("addStudents")}
          </Button>
        ) : undefined
      }
    >
      {noStudents ? (
        <EmptyState title={t("empty")} description={isTeacher ? t("emptyDetail") : undefined} />
      ) : (
        <div className="flex flex-col gap-6">
          <FilterBar search={searchStudentInput} onSearchChange={setSearchStudentInput} searchPlaceholder={t("search")} />
          {isTeacher && sections.length > 1 ? (
            <Select
              label={t("section")}
              placeholder={t("allSections")}
              value={sectionFilter}
              fieldClassName="sm:max-w-xs"
              options={sections.map(([id, name]) => ({ value: id, label: name }))}
              onChange={(e) => setSectionFilter(e.target.value)}
            />
          ) : null}

          {isTeacher ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-body font-semibold text-ink">{t("pending", { count: filteredStudent.pending.length })}</h3>
              {filteredStudent.pending.length ? (
                <Table caption={t("pending", { count: filteredStudent.pending.length })} columns={pendingColumns} rows={filteredStudent.pending} getRowId={(row) => row.id} />
              ) : (
                <p className="text-body-sm text-ink-muted">{t("noPending")}</p>
              )}
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-ink">
              {t("active", { count: isTeacher ? filteredStudent.activeStudents.length : filteredStudent.classmates.length })}
            </h3>
            {isTeacher ? (
              <Table caption={t("title")} columns={memberColumns} rows={filteredStudent.activeStudents} getRowId={(row) => row.id} defaultSort={{ key: "status", direction: "desc" }} />
            ) : (
              <Table
                caption={t("title")}
                columns={classmateColumns}
                rows={filteredStudent.classmates}
                getRowId={(row) => `${row.name}-${row.joined_at}`}
              />
            )}
          </section>
        </div>
      )}

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={t("detailsTitle")} size="sm">
        {viewing ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-body-sm">
            <dt className="text-ink-muted">{t("name")}</dt>
            <dd className="text-ink">{nameOf(viewing)}</dd>
            <dt className="text-ink-muted">{t("studentId")}</dt>
            <dd className="text-ink">{viewing.student?.student_public_id || "—"}</dd>
            <dt className="text-ink-muted">{t("contact")}</dt>
            <dd className="text-ink">{getClassStudentContact(viewing)}</dd>
            <dt className="text-ink-muted">{t("status")}</dt>
            <dd className="text-ink">{viewing.status === "JOINED" ? t("joined") : t("invited")}</dd>
            {viewing.joined_at ? (
              <>
                <dt className="text-ink-muted">{t("joinedOn")}</dt>
                <dd className="text-ink">{format.date(viewing.joined_at)}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        tone="danger"
        title={removing ? t("removeTitle", { name: nameOf(removing) }) : ""}
        description={t("removeDetail")}
        confirmLabel={t("removeConfirm")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) handleRemoveStudent(removing);
          setRemoving(null);
        }}
      />

      {isTeacher ? <AddStudentModal fetchClassDetails={fetch} /> : null}
    </Card>
  );
};

export default ClassStudent;
