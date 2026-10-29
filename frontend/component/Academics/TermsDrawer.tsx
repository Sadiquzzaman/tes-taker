"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button, ConfirmDialog, DatePicker, Drawer, EmptyState, IconButton, Input, Skeleton, Table, type TableColumn } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import EditSquareIconSVG from "../svg/EditSquareIconSVG";
import TrashIcon from "../svg/TrashIcon";

type TermDraft = { id: string | null; name: string; start: string; end: string };
const EMPTY_DRAFT: TermDraft = { id: null, name: "", start: "", end: "" };

/** The terms of a session (half-yearly, annual, …): list, add, edit, delete. Read-only when the session is closed. */
/** Mounted (keyed by session) only while open. */
const TermsDrawer = ({ session, onClose, canManage }: { session: AcademicSession; onClose: () => void; canManage: boolean }) => {
  const t = useTranslations("academics.terms");
  const format = useFormat();
  const { baseUrl, run } = useAcademicsRequest();
  const [terms, setTerms] = useState<AcademicTerm[] | null>(null);
  const [draft, setDraft] = useState<TermDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<AcademicTerm | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = canManage && session.status === "ACTIVE";

  const fetchTerms = useCallback(
    () => run(() => axiosReq.get<ApiResponse<AcademicTerm[]>>(`${baseUrl}/sessions/${session.id}/terms`)).then((res) => res?.data?.payload ?? []),
    [baseUrl, run, session.id],
  );
  const load = useCallback(() => void fetchTerms().then(setTerms), [fetchTerms]);

  useEffect(() => {
    void fetchTerms().then(setTerms);
  }, [fetchTerms]);

  const save = async () => {
    setSaving(true);
    const body = { name: draft.name.trim(), start_date: draft.start || undefined, end_date: draft.end || undefined };
    const saved = await run(
      () =>
        draft.id
          ? axiosReq.patch(`${baseUrl}/terms/${draft.id}`, { ...body, start_date: draft.start || null, end_date: draft.end || null })
          : axiosReq.post(`${baseUrl}/sessions/${session.id}/terms`, { ...body, sort_order: terms?.length ?? 0 }),
      t("saved"),
    );
    setSaving(false);
    if (saved) {
      setDraft(EMPTY_DRAFT);
      load();
    }
  };

  const remove = async (term: AcademicTerm) => {
    setDeleting(null);
    if (await run(() => axiosReq.delete(`${baseUrl}/terms/${term.id}`), t("deleted"))) load();
  };

  const dateOrDash = (value: string | null) => (value ? format.date(value) : "—");
  const columns: TableColumn<AcademicTerm>[] = [
    { key: "name", header: t("name"), cell: (row) => row.name },
    { key: "dates", header: `${t("start")} – ${t("end")}`, cell: (row) => `${dateOrDash(row.start_date)} – ${dateOrDash(row.end_date)}` },
    ...(editable
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (row: AcademicTerm) => (
              <div className="flex justify-end gap-1">
                <IconButton
                  size="sm"
                  label={t("editFor", { name: row.name })}
                  icon={<EditSquareIconSVG />}
                  onClick={() => setDraft({ id: row.id, name: row.name, start: row.start_date ?? "", end: row.end_date ?? "" })}
                />
                <IconButton size="sm" label={t("deleteFor", { name: row.name })} icon={<TrashIcon />} className="text-danger" onClick={() => setDeleting(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  const datesInvalid = Boolean(draft.start && draft.end && draft.end < draft.start);

  return (
    <Drawer open onClose={onClose} title={session.name} wide>
      <div className="flex flex-col gap-6">
        {terms === null ? (
          <Skeleton lines={3} />
        ) : terms.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <Table caption={session.name} columns={columns} rows={terms} getRowId={(row) => row.id} />
        )}

        {editable ? (
          <form
            className="flex flex-col gap-3 rounded-card border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Input label={t("name")} placeholder={t("namePlaceholder")} value={draft.name} maxLength={80} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DatePicker label={t("start")} value={draft.start} onChange={(start) => setDraft({ ...draft, start })} />
              <DatePicker label={t("end")} value={draft.end} min={draft.start || undefined} onChange={(end) => setDraft({ ...draft, end })} />
            </div>
            <div className="flex justify-end gap-2">
              {draft.id ? (
                <Button variant="secondary" onClick={() => setDraft(EMPTY_DRAFT)}>
                  {t("cancelEdit")}
                </Button>
              ) : null}
              <Button type="submit" disabled={!draft.name.trim() || datesInvalid} loading={saving}>
                {draft.id ? t("save") : t("add")}
              </Button>
            </div>
          </form>
        ) : session.status === "CLOSED" ? (
          <p className="text-body-sm text-ink-muted">{t("closedNote")}</p>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={deleting ? t("deleteTitle", { name: deleting.name }) : ""}
        description={t("deleteDetail")}
        confirmLabel={t("deleteConfirm")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
    </Drawer>
  );
};

export default TermsDrawer;
