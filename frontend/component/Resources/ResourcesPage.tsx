"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Switch } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import ResourceForm from "./ResourceForm";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

/** Where a resource opens: a link as it is, a file through the API. */
const hrefOf = (r: LibraryResource) => (r.type === "LINK" ? r.url : `${BASE}${r.url}`);

/** The resource library (P9-03, Epic 8): staff manage it; students see what is shared with them. */
const ResourcesPage = () => {
  const { memberRole } = useWorkspace();
  return memberRole === "STUDENT" ? <MyResources /> : <ResourceLibrary />;
};

/** One resource's line: type, title, subject, who shared it, tags. */
const ResourceSummary = ({ resource, extra }: { resource: LibraryResource; extra?: React.ReactNode }) => {
  const t = useTranslations("resources");
  const format = useFormat();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={resource.type === "LINK" ? "info" : "neutral"}>{t(`types.${resource.type}`)}</Badge>
        <span className="font-medium text-ink">{resource.title}</span>
        {extra}
      </div>
      {resource.description ? <p className="text-body-sm text-ink-muted">{resource.description}</p> : null}
      <p className="text-caption text-ink-muted">
        {[resource.subject?.name, resource.created_by.name, format.date(resource.created_at, { dateStyle: "medium" }), ...resource.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
};

// ------------------------------------------------------------------ staff

const ResourceLibrary = () => {
  const t = useTranslations("resources");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [archived, setArchived] = useState(false);
  const { data: items, failed, reload } = useApiData<LibraryResource[]>("/resources", { q: q.trim() || undefined, folder_id: folder || undefined, archived: archived ? "true" : undefined });
  const { data: options } = useApiData<ResourceShareOption[]>("/resources/subject-classes");
  const { data: folders, reload: reloadFolders } = useApiData<ResourceFolder[]>("/resources/folders");
  const [editing, setEditing] = useState<LibraryResource | "new" | null>(null);
  const [deleting, setDeleting] = useState<LibraryResource | null>(null);
  const [insightsOf, setInsightsOf] = useState<LibraryResource | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);

  const call = async (run: () => Promise<unknown>, done: string) => {
    try {
      await run();
      triggerToast({ title: done, type: "success" });
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  const currentFolder = folders?.find((f) => f.id === folder) ?? null;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("staffDescription")} actions={<Button onClick={() => setEditing("new")}>{t("add")}</Button>} />
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <Input label={t("search")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
          <Select
            label={t("folder")}
            placeholder={t("allFolders")}
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            options={[{ value: "none", label: t("noFolder") }, ...(folders ?? []).map((f) => ({ value: f.id, label: f.name }))]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFolderName("")}>
              {t("newFolder")}
            </Button>
            {currentFolder ? (
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  void call(() => axiosReq.delete(`${BASE}/resources/folders/${currentFolder.id}`), t("folderDeleted")).then(() => {
                    setFolder("");
                    reloadFolders();
                  })
                }
              >
                {t("deleteFolder")}
              </Button>
            ) : null}
          </div>
        </div>
        <Switch className="mt-3" label={t("showArchived")} checked={archived} onChange={setArchived} />
      </Card>

      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !items ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title={archived ? t("noArchived") : t("empty")} description={archived ? undefined : t("emptyHint")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("listLabel")}>
          {items.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <ResourceSummary resource={r} extra={!r.download_allowed ? <Badge tone="warning">{t("viewOnly")}</Badge> : null} />
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <a href={hrefOf(r)} target="_blank" rel="noreferrer" className="inline-flex items-center px-2 text-body-sm text-primary underline">
                      {t("open")}
                    </a>
                    {r.can_edit ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setInsightsOf(r)}>
                          {t("whoOpened")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                          {t("edit")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void call(() => axiosReq.patch(`${BASE}/resources/${r.id}`, { archived: !r.archived }), r.archived ? t("restored") : t("archivedDone"))}>
                          {r.archived ? t("restore") : t("archive")}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(r)}>
                          {t("delete")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-caption text-ink-muted">{r.shares.length ? t("sharedWith", { classes: r.shares.map((s) => s.label).join(", ") }) : t("notShared")}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ResourceForm
          open
          resource={editing === "new" ? null : editing}
          options={options ?? []}
          folders={folders ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            triggerToast({ title: t("saved"), type: "success" });
            reload();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={t("deleteTitle", { title: deleting?.title ?? "" })}
        description={t("deleteDetail")}
        confirmLabel={t("delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void call(() => axiosReq.delete(`${BASE}/resources/${target.id}`), t("deleted"));
        }}
      />
      <Modal
        open={folderName !== null}
        onClose={() => setFolderName(null)}
        title={t("newFolder")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFolderName(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!folderName?.trim()}
              onClick={() =>
                void call(() => axiosReq.post(`${BASE}/resources/folders`, { name: folderName }), t("folderAdded")).then(() => {
                  setFolderName(null);
                  reloadFolders();
                })
              }
            >
              {t("save")}
            </Button>
          </>
        }
      >
        <Input label={t("folderName")} maxLength={120} value={folderName ?? ""} onChange={(e) => setFolderName(e.target.value)} />
      </Modal>
      <Drawer open={Boolean(insightsOf)} onClose={() => setInsightsOf(null)} title={insightsOf?.title ?? ""} description={t("whoOpened")}>
        {insightsOf ? <Insights id={insightsOf.id} /> : null}
      </Drawer>
    </div>
  );
};

/** Who opened a resource and who has not (RES-06). */
const Insights = ({ id }: { id: string }) => {
  const t = useTranslations("resources");
  const format = useFormat();
  const { data } = useApiData<ResourceInsights>(`/resources/${id}/insights`);
  if (!data) return <Skeleton lines={4} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink">{t("openedCount", { opened: data.opened.length, total: data.students })}</p>
      <section className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-ink">{t("opened")}</h3>
        {data.opened.length === 0 ? <p className="text-body-sm text-ink-muted">{t("nobodyYet")}</p> : null}
        <ul className="flex flex-col gap-1 text-body-sm" aria-label={t("opened")}>
          {data.opened.map((s) => (
            <li key={s.student_id} className="flex justify-between gap-3">
              <span>{s.full_name}</span>
              <span className="text-ink-muted">{t("openedAt", { time: format.date(s.last_opened_at, { dateStyle: "medium", timeStyle: "short" }), count: s.opens })}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-ink">{t("notOpened")}</h3>
        <ul className="flex flex-col gap-1 text-body-sm" aria-label={t("notOpened")}>
          {data.not_opened.map((s) => (
            <li key={s.student_id} className="flex justify-between gap-3">
              <span>{s.full_name}</span>
              <span className="text-ink-muted">{s.via}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

// ------------------------------------------------------------------ students

const MyResources = () => {
  const t = useTranslations("resources");
  const { handleError } = useApiError();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const { data: items, failed, reload, setData } = useApiData<LibraryResource[]>("/resources/mine", { q: q.trim() || undefined, subject_id: subject || undefined, type: type || undefined });
  const subjects = [...new Map((items ?? []).filter((r) => r.subject).map((r) => [r.subject!.id, r.subject!.name])).entries()];

  /** Opening is recorded (the "New" badge goes, the teacher sees it), then the resource opens in a new tab. */
  const openIt = async (r: LibraryResource) => {
    const tab = window.open("", "_blank");
    try {
      await axiosReq.post(`${BASE}/resources/${r.id}/open`);
      if (items) setData(items.map((x) => (x.id === r.id ? { ...x, is_new: false } : x)));
      if (tab) tab.location.href = hrefOf(r);
    } catch (err) {
      tab?.close();
      handleError(err as AxiosError<ApiError>);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("studentDescription")} />
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label={t("search")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
          <Select label={t("subject")} placeholder={t("allSubjects")} value={subject} onChange={(e) => setSubject(e.target.value)} options={subjects.map(([id, name]) => ({ value: id, label: name }))} />
          <Select
            label={t("type")}
            placeholder={t("allTypes")}
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: "FILE", label: t("types.FILE") },
              { value: "LINK", label: t("types.LINK") },
            ]}
          />
        </div>
      </Card>
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !items ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title={t("studentEmpty")} description={t("studentEmptyHint")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("listLabel")}>
          {items.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <ResourceSummary resource={r} extra={r.is_new ? <Badge tone="success">{t("new")}</Badge> : null} />
                  <Button size="sm" className="shrink-0" onClick={() => void openIt(r)}>
                    {t("open")}
                  </Button>
                </div>
                {r.type === "FILE" && !r.download_allowed ? <p className="mt-2 text-caption text-ink-muted">{t("viewOnlyNote")}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ResourcesPage;
