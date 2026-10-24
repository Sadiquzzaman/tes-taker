"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, Drawer, EmptyState, FilterBar, Input, PageHeader, Skeleton, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  created_user_name?: string | null;
};

type SubjectDraft = { id?: string; name: string; code: string };

/** The shared subject list: add, rename and permanently delete subjects. */
const AdminSubjectsTable = () => {
  const t = useTranslations("admin");
  const tUi = useTranslations("ui");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SubjectDraft | null>(null);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get(`${baseUrl}/subjects`);
      setSubjects(res.data?.payload ?? []);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? subjects.filter((subject) => subject.name.toLowerCase().includes(q) || (subject.code ?? "").toLowerCase().includes(q)) : subjects;
  }, [subjects, search]);

  const isNew = !editing?.id;

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      triggerToast({ title: t("common.missingTitle"), description: t("subjects.nameRequired"), type: "error" });
      return;
    }
    setSaving(true);
    const body = { name: editing.name.trim(), code: editing.code.trim() || null };
    try {
      if (isNew) {
        await axiosReq.post(`${baseUrl}/subjects`, body);
        triggerToast({ title: t("common.createdTitle"), description: t("subjects.created"), type: "success" });
      } else {
        await axiosReq.patch(`${baseUrl}/subjects/${editing.id}`, body);
        triggerToast({ title: t("common.savedTitle"), description: t("subjects.saved"), type: "success" });
      }
      setEditing(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const hardDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/subjects/${deleting.id}`);
      triggerToast({ title: t("common.deletedTitle"), description: t("subjects.deleted"), type: "success" });
      setDeleting(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<SubjectRow>[] = [
    { key: "name", header: t("common.name"), cell: (row) => <span className="font-medium">{row.name}</span>, sortValue: (row) => row.name },
    { key: "code", header: t("subjects.code"), cell: (row) => row.code ?? "—", sortValue: (row) => row.code },
    { key: "createdBy", header: t("subjects.createdBy"), cell: (row) => row.created_user_name ?? "—", hideOnMobile: true },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: row.id, name: row.name, code: row.code ?? "" })}>
            {t("common.edit")}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(row)}>
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("subjects.title")}
        description={t("subjects.intro")}
        actions={<Button onClick={() => setEditing({ name: "", code: "" })}>{t("subjects.add")}</Button>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar className="flex-1" search={search} onSearchChange={setSearch} searchPlaceholder={t("subjects.search")} />
        <p className="text-body-sm text-ink-muted">{t("subjects.total", { count: filtered.length })}</p>
      </div>
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table caption={t("subjects.title")} columns={columns} rows={filtered} getRowId={(row) => row.id} empty={<EmptyState title={t("subjects.empty")} />} />
        )}
      </Card>

      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={isNew ? t("subjects.add") : t("subjects.editTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {tUi("cancel")}
            </Button>
            <Button type="submit" form="admin-subject-form" loading={saving}>
              {isNew ? t("subjects.add") : t("common.save")}
            </Button>
          </>
        }
      >
        <form
          id="admin-subject-form"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <Input
            label={t("common.name")}
            required
            placeholder={t("subjects.namePlaceholder")}
            value={editing?.name ?? ""}
            onChange={(event) => setEditing((current) => (current ? { ...current, name: event.target.value } : current))}
          />
          <Input
            label={t("subjects.codeOptional")}
            placeholder={t("subjects.codePlaceholder")}
            value={editing?.code ?? ""}
            onChange={(event) => setEditing((current) => (current ? { ...current, code: event.target.value } : current))}
          />
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={t("common.deleteForever", { name: deleting?.name ?? "" })}
        description={t("common.deleteForeverDetail")}
        confirmLabel={t("common.delete")}
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void hardDelete()}
      />
    </div>
  );
};

export default AdminSubjectsTable;
