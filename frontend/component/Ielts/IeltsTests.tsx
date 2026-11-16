"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, ErrorState, Input, Link, Modal, PageHeader, RadioGroup, Select, Skeleton, StatusPill, Table, type BadgeTone, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { IELTS_MODULES, PART_COUNT } from "./bands";
import OldExams from "./OldExams";

const STATUS_TONE: Record<IeltsTestStatus, BadgeTone> = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" };

/**
 * IELTS tests (P10-03, IEL-03) for a centre's staff: mocks and practice sets with their status and
 * questions per module; new tests start from the real template; copy, archive or delete.
 */
const IeltsTests = () => {
  const t = useTranslations("ieltsTests");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const router = useRouter();
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState("");
  const { data: rows, failed, reload } = useApiData<IeltsTestSummary[]>("/ielts/tests", { purpose: purpose || undefined, status: status || undefined });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<IeltsTestSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const base = process.env.NEXT_PUBLIC_BASE_URL;

  const act = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      triggerToast({ title: done, type: "success" });
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const copy = (row: IeltsTestSummary) =>
    act(async () => {
      const res = await axiosReq.post<{ payload: IeltsTest }>(`${base}/ielts/tests/${row.id}/duplicate`);
      router.push(`/ielts/tests/${res.data.payload.id}`);
    }, t("copied"));

  /** "Listening 40 · Reading 12" — numbers used per module that has questions. */
  const questions = (row: IeltsTestSummary) =>
    row.modules
      .filter((m) => m === "LISTENING" || m === "READING")
      .map((m) => `${t(`modulesShort.${m}`)} ${format.number(row.question_counts[m] ?? 0)}${row.purpose === "MOCK" ? "/40" : ""}`)
      .join(" · ") || "—";

  const columns: TableColumn<IeltsTestSummary>[] = [
    {
      key: "title",
      header: t("title"),
      cell: (r) => (
        <span className="flex flex-col">
          <Link href={`/ielts/tests/${r.id}`} className="font-medium">
            {r.title}
          </Link>
          {r.needs_review ? <span className="text-xs text-warning">{t("needsReview")}</span> : null}
        </span>
      ),
      sortValue: (r) => r.title,
    },
    { key: "purpose", header: t("purpose"), cell: (r) => <Badge tone={r.purpose === "MOCK" ? "primary" : "info"}>{t(`purposes.${r.purpose}`)}</Badge> },
    { key: "type", header: t("testType"), hideOnMobile: true, cell: (r) => t(`types.${r.test_type}`) },
    { key: "modules", header: t("modules"), hideOnMobile: true, cell: (r) => r.modules.map((m) => t(`modulesShort.${m}`)).join(", ") },
    { key: "questions", header: t("questions"), hideOnMobile: true, cell: questions },
    { key: "status", header: t("status"), cell: (r) => <StatusPill tone={STATUS_TONE[r.status]}>{t(`statuses.${r.status}`)}</StatusPill> },
    { key: "updated", header: t("updated"), hideOnMobile: true, cell: (r) => format.date(r.updated_at, { dateStyle: "medium" }), sortValue: (r) => r.updated_at },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (r) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void copy(r)} aria-label={t("copyFor", { title: r.title })}>
            {t("copy")}
          </Button>
          {r.status !== "ARCHIVED" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void act(() => axiosReq.post(`${base}/ielts/tests/${r.id}/archive`).then(() => undefined), t("archived"))}
              aria-label={t("archiveFor", { title: r.title })}
            >
              {t("archive")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeleting(r)} aria-label={t("deleteFor", { title: r.title })}>
            {t("delete")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} actions={<Button onClick={() => setCreating(true)}>{t("newTest")}</Button>} />
      <Card>
        <div className="flex flex-wrap gap-4">
          <Select
            label={t("purpose")}
            placeholder={t("allPurposes")}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            options={(["MOCK", "PRACTICE"] as const).map((p) => ({ value: p, label: t(`purposes.${p}`) }))}
            fieldClassName="w-48"
          />
          <Select
            label={t("status")}
            placeholder={t("allStatuses")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
            fieldClassName="w-48"
          />
        </div>
      </Card>
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !rows ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : (
        <Table
          caption={t("caption")}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          empty={<EmptyState title={t("empty")} description={t("emptyHint")} action={<Button onClick={() => setCreating(true)}>{t("newTest")}</Button>} />}
        />
      )}
      <OldExams />
      {creating ? <CreateTestModal onClose={() => setCreating(false)} onCreated={(id) => router.push(`/ielts/tests/${id}`)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t("deleteTitle")}
        description={t("deleteDescription", { title: deleting?.title ?? "" })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        tone="danger"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const row = deleting;
          setDeleting(null);
          if (row) void act(() => axiosReq.delete(`${base}/ielts/tests/${row.id}`).then(() => undefined), t("deleted"));
        }}
      />
    </div>
  );
};

/** A new draft: a mock gets every part of its modules; a practice set the chosen parts of one module. */
const CreateTestModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) => {
  const t = useTranslations("ieltsTests");
  const { handleError } = useApiError();
  const [title, setTitle] = useState("");
  const [testType, setTestType] = useState<IeltsTestType>("ACADEMIC");
  const [purpose, setPurpose] = useState<IeltsTestPurpose>("MOCK");
  const [modules, setModules] = useState<IeltsModule[]>([...IELTS_MODULES]);
  const [module, setModule] = useState<IeltsModule>("READING");
  const [parts, setParts] = useState<number[]>([1]);
  const [busy, setBusy] = useState(false);
  const ready = title.trim().length > 0 && (purpose === "MOCK" ? modules.length > 0 : parts.length > 0);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.post<{ payload: IeltsTest }>(`${process.env.NEXT_PUBLIC_BASE_URL}/ielts/tests`, {
        title: title.trim(),
        test_type: testType,
        purpose,
        ...(purpose === "MOCK" ? { modules } : { module, part_nos: parts }),
      });
      onCreated(res.data.payload.id);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("newTest")}
      description={t("newTestDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} disabled={!ready} onClick={() => void create()}>
            {t("create")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Input label={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        <RadioGroup
          legend={t("testType")}
          name="ielts-test-type"
          inline
          value={testType}
          onChange={(value) => setTestType(value as IeltsTestType)}
          options={(["ACADEMIC", "GENERAL"] as const).map((v) => ({ value: v, label: t(`types.${v}`) }))}
        />
        <RadioGroup
          legend={t("purpose")}
          name="ielts-test-purpose"
          value={purpose}
          onChange={(value) => setPurpose(value as IeltsTestPurpose)}
          options={(["MOCK", "PRACTICE"] as const).map((v) => ({ value: v, label: t(`purposes.${v}`), hint: t(`purposeHints.${v}`) }))}
        />
        {purpose === "MOCK" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("modules")}</legend>
            {IELTS_MODULES.map((m) => (
              <Checkbox key={m} label={t(`modulesShort.${m}`)} checked={modules.includes(m)} onChange={() => setModules(toggle(modules, m))} />
            ))}
          </fieldset>
        ) : (
          <>
            <Select
              label={t("module")}
              value={module}
              onChange={(e) => {
                setModule(e.target.value as IeltsModule);
                setParts([1]);
              }}
              options={IELTS_MODULES.map((m) => ({ value: m, label: t(`modulesShort.${m}`) }))}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-ink">{t("parts")}</legend>
              {Array.from({ length: PART_COUNT[module] }, (_, i) => i + 1).map((no) => (
                <Checkbox key={no} label={t(`partNames.${module}`, { no })} checked={parts.includes(no)} onChange={() => setParts(toggle(parts, no))} />
              ))}
            </fieldset>
          </>
        )}
      </div>
    </Modal>
  );
};

export default IeltsTests;
