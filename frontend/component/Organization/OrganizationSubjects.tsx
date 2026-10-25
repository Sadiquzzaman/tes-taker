"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, Drawer, EmptyState, Input, PageHeader, Skeleton, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

type SubjectDraft = { id: string | null; name: string; code: string };

/** The organisation's subject list: create, rename and delete subjects. */
const OrganizationSubjectsContent = () => {
  const t = useTranslations("organization.subjects");
  const tUi = useTranslations("ui");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [subjects, setSubjects] = useState<OrganizationSubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // One form for both create (id null) and edit.
  const [draft, setDraft] = useState<SubjectDraft | null>(null);
  const [deleting, setDeleting] = useState<OrganizationSubjectItem | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationSubjectItem[]>>(`${baseUrl}/organizations/${organizationId}/subjects`);
      setSubjects(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!draft || !organizationId) return;
    const name = draft.name.trim();
    const code = draft.code.trim();
    if (!name || !code) {
      triggerToast({ title: t("requiredTitle"), description: t("required"), type: "error" });
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await axiosReq.patch(`${baseUrl}/organizations/${organizationId}/subjects/${draft.id}`, { name, code });
        triggerToast({ title: t("updatedTitle"), description: t("updated"), type: "success" });
      } else {
        await axiosReq.post(`${baseUrl}/organizations/${organizationId}/subjects`, { name, code });
        triggerToast({ title: t("createdTitle"), description: t("created"), type: "success" });
      }
      setDraft(null);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!organizationId || !deleting) return;
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/organizations/${organizationId}/subjects/${deleting.id}`);
      triggerToast({ title: t("deletedTitle"), description: t("deleted"), type: "success" });
      setDeleting(null);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<OrganizationSubjectItem>[] = [
    { key: "name", header: t("name"), cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "code", header: t("code"), cell: (row) => row.code || "—", sortValue: (row) => row.code },
    { key: "classes", header: t("classes"), cell: (row) => (row.classes ?? []).map((item) => item.class_name).join(", ") || "—", hideOnMobile: true },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDraft({ id: row.id, name: row.name, code: row.code || "" })}>
            {t("edit")}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(row)}>
            {t("delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={activeOrganization?.name}
        actions={<Button onClick={() => setDraft({ id: null, name: "", code: "" })}>{t("create")}</Button>}
      />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table caption={t("title")} columns={columns} rows={subjects} getRowId={(row) => row.id} empty={<EmptyState title={t("empty")} />} />
        )}
      </Card>

      <Drawer
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("editTitle") : t("create")}
        description={draft?.id ? undefined : t("createIntro")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              {tUi("cancel")}
            </Button>
            <Button type="submit" form="subject-form" loading={saving}>
              {draft?.id ? t("save") : t("create")}
            </Button>
          </>
        }
      >
        <form
          id="subject-form"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <Input
            label={t("name")}
            required
            placeholder={t("namePlaceholder")}
            value={draft?.name ?? ""}
            onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))}
          />
          <Input
            label={t("code")}
            required
            placeholder={t("codePlaceholder")}
            value={draft?.code ?? ""}
            onChange={(event) => setDraft((current) => (current ? { ...current, code: event.target.value } : current))}
          />
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        description={t("deleteDetail")}
        confirmLabel={t("delete")}
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
};

const OrganizationSubjects = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN", "ASSISTANT"]}>
    <OrganizationSubjectsContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationSubjects;
