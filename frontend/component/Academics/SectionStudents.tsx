"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusPill,
  Table,
  type BadgeTone,
  type TableColumn,
} from "@/design/ui";
import { useToast } from "@/component/Toast/ToastContext";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";
import EditSquareIconSVG from "../svg/EditSquareIconSVG";
import TrashIcon from "../svg/TrashIcon";
import GuardiansDrawer from "./GuardiansDrawer";
import PromoteStudentsDrawer from "./PromoteStudentsDrawer";

const STATUS_TONE: Record<EnrolmentStatus, BadgeTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  INVITED: "info",
  LEFT: "neutral",
  PROMOTED: "neutral",
};

const isCurrent = (row: SectionEnrolment) => row.status !== "LEFT" && row.status !== "PROMOTED";

/**
 * The students of a section (FND-04): add by phone or email, move to another section of the class,
 * set the roll number, or mark as left. Nobody is deleted; students who left can be shown. Owners
 * and admins promote the active students into the next session (FND-05), also from a closed session.
 * Each current student's guardians (FND-09) open in a drawer, for teachers of the class too.
 */
const SectionStudents = ({
  section,
  sections,
  editable,
  onChanged,
}: {
  section: ClassSection;
  /** The class's sections in the same session (move targets). */
  sections: ClassSection[];
  editable: boolean;
  onChanged: () => void;
}) => {
  const t = useTranslations("academics.enrolments");
  const tGuardians = useTranslations("academics.guardians");
  const { baseUrl, run, canManageSessions } = useAcademicsRequest();
  const { triggerToast } = useToast();
  const [promoting, setPromoting] = useState(false);
  const [rows, setRows] = useState<SectionEnrolment[] | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [contact, setContact] = useState("");
  const [roll, setRoll] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SectionEnrolment | null>(null);
  const [editSection, setEditSection] = useState("");
  const [editRoll, setEditRoll] = useState("");
  const [leaving, setLeaving] = useState<SectionEnrolment | null>(null);
  const [guardiansOf, setGuardiansOf] = useState<SectionEnrolment | null>(null);

  const fetchRows = useCallback(
    () => run(() => axiosReq.get<ApiResponse<SectionEnrolment[]>>(`${baseUrl}/sections/${section.id}/enrolments`)).then((res) => res?.data?.payload ?? []),
    [baseUrl, run, section.id],
  );

  useEffect(() => {
    void fetchRows().then(setRows);
  }, [fetchRows]);

  const reload = () => {
    void fetchRows().then(setRows);
    onChanged();
  };

  const nameOf = (row: SectionEnrolment) =>
    row.student?.full_name ||
    (row.invited_name
      ? t("invitedNamed", { name: row.invited_name, contact: row.invited_email || row.invited_phone || "—" })
      : t("invitedContact", { contact: row.invited_email || row.invited_phone || "—" }));

  const add = async () => {
    const value = contact.trim();
    setAdding(true);
    const res = await run(() =>
      axiosReq.post<ApiResponse<{ outcome: "ENROLLED" | "PENDING" | "INVITED" }>>(`${baseUrl}/sections/${section.id}/enrolments`, {
        ...(value.includes("@") ? { email: value } : { phone: value }),
        roll_no: roll.trim() || undefined,
      }),
    );
    setAdding(false);
    if (!res) return;
    const outcome = res.data?.payload?.outcome;
    // The toast says what happened: added, waiting for verification, or an invitation saved.
    triggerToast({ title: outcome === "INVITED" ? t("invited") : outcome === "PENDING" ? t("pendingAdded") : t("added"), type: "success" });
    setContact("");
    setRoll("");
    reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = {
      ...(editSection && editSection !== section.id ? { section_id: editSection } : {}),
      roll_no: editRoll.trim() || null,
    };
    const saved = await run(() => axiosReq.patch(`${baseUrl}/enrolments/${editing.id}`, body), t("saved"));
    if (saved) {
      setEditing(null);
      reload();
    }
  };

  const markLeft = async (row: SectionEnrolment) => {
    setLeaving(null);
    if (await run(() => axiosReq.patch(`${baseUrl}/enrolments/${row.id}`, { status: "LEFT" }), t("left"))) reload();
  };

  const visible = (rows ?? []).filter((row) => showLeft || isCurrent(row));
  const active = (rows ?? []).filter((row) => row.status === "ACTIVE" && row.student);
  const columns: TableColumn<SectionEnrolment>[] = [
    // The student first: on phones the first column is each card's title.
    { key: "student", header: t("student"), cell: nameOf, sortValue: nameOf },
    { key: "roll", header: t("roll"), cell: (row) => row.roll_no || "—", sortValue: (row) => Number(row.roll_no) || row.roll_no || "" },
    {
      key: "status",
      header: t("status"),
      cell: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{t(`statuses.${row.status}`)}</StatusPill>,
      sortValue: (row) => row.status,
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right" as const,
      cell: (row: SectionEnrolment) =>
        isCurrent(row) ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" aria-label={tGuardians("openFor", { name: nameOf(row) })} onClick={() => setGuardiansOf(row)}>
              {tGuardians("open")}
            </Button>
            {editable ? (
              <>
                <IconButton
                  size="sm"
                  label={t("editFor", { name: nameOf(row) })}
                  icon={<EditSquareIconSVG />}
                  onClick={() => {
                    setEditing(row);
                    setEditSection(section.id);
                    setEditRoll(row.roll_no ?? "");
                  }}
                />
                <IconButton size="sm" label={t("leaveFor", { name: nameOf(row) })} icon={<TrashIcon />} className="text-danger" onClick={() => setLeaving(row)} />
              </>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {editable ? (
        <form
          className="flex flex-col gap-3 rounded-card border border-border p-4 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Input label={t("contact")} hint={t("contactHint")} value={contact} required fieldClassName="flex-1" onChange={(e) => setContact(e.target.value)} />
          <Input label={t("rollNo")} value={roll} maxLength={20} fieldClassName="sm:w-28" onChange={(e) => setRoll(e.target.value)} />
          <Button type="submit" disabled={!contact.trim()} loading={adding}>
            {t("add")}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox label={t("showLeft")} checked={showLeft} onChange={(e) => setShowLeft(e.target.checked)} />
        {canManageSessions && active.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => setPromoting(true)}>
            {t("promote")}
          </Button>
        ) : null}
      </div>

      {rows === null ? (
        <Skeleton lines={4} />
      ) : visible.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table caption={section.name} columns={columns} rows={visible} getRowId={(row) => row.id} defaultSort={{ key: "roll", direction: "asc" }} />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? t("editTitle", { name: nameOf(editing) }) : ""}
        size="sm"
        footer={<Button onClick={() => void saveEdit()}>{t("save")}</Button>}
      >
        <div className="flex flex-col gap-4">
          <Select
            label={t("section")}
            placeholder={false}
            value={editSection}
            options={sections.map((option) => ({ value: option.id, label: option.name }))}
            onChange={(e) => setEditSection(e.target.value)}
          />
          <Input label={t("rollNo")} value={editRoll} maxLength={20} onChange={(e) => setEditRoll(e.target.value)} />
        </div>
      </Modal>

      {guardiansOf ? (
        <GuardiansDrawer enrolmentId={guardiansOf.id} studentName={nameOf(guardiansOf)} onClose={() => setGuardiansOf(null)} />
      ) : null}

      {promoting ? (
        <PromoteStudentsDrawer section={section} students={active} onClose={() => setPromoting(false)} onPromoted={reload} />
      ) : null}

      <ConfirmDialog
        open={Boolean(leaving)}
        tone="danger"
        title={leaving ? t("leaveTitle", { name: nameOf(leaving) }) : ""}
        description={t("leaveDetail")}
        confirmLabel={t("leaveConfirm")}
        onCancel={() => setLeaving(null)}
        onConfirm={() => leaving && void markLeft(leaving)}
      />
    </div>
  );
};

export default SectionStudents;
