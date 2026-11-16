"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, DatePicker, Drawer, EmptyState, ErrorState, Link, PageHeader, Select, Skeleton, Table, TimePicker, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import { fromZonedParts, toZonedParts } from "@/i18n/zonedTime";
import axiosReq from "@/lib/axios";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

/**
 * Opening an IELTS test for batches (P10-04, IEL-08): each opening's batch, window, size and
 * hand-ins per module; open for another batch, change the window, remove; each student's raw
 * score and band per module.
 */
const TestOpenings = ({ testId }: { testId: string }) => {
  const t = useTranslations("ieltsOpenings");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: test, failed: testFailed } = useApiData<IeltsTest>(`/ielts/tests/${testId}`);
  const { data: rows, failed, reload } = useApiData<IeltsAssignment[]>(`/ielts/tests/${testId}/assignments`);
  const [editing, setEditing] = useState<IeltsAssignment | "new" | null>(null);
  const [removing, setRemoving] = useState<IeltsAssignment | null>(null);
  const [results, setResults] = useState<IeltsAssignment | null>(null);

  const remove = async (row: IeltsAssignment) => {
    try {
      await axiosReq.delete(`${BASE}/ielts/assignments/${row.id}`);
      triggerToast({ title: t("removed"), type: "success" });
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };

  const modules = test?.modules ?? [];
  const columns: TableColumn<IeltsAssignment>[] = [
    { key: "batch", header: t("batch"), cell: (r) => <span className="font-medium text-ink">{r.section.name}</span>, sortValue: (r) => r.section.name },
    { key: "window", header: t("window"), cell: (r) => `${format.dateTime(r.opens_at)} – ${format.dateTime(r.closes_at)}`, sortValue: (r) => r.opens_at },
    {
      key: "handed",
      header: t("handedIn"),
      hideOnMobile: true,
      cell: (r) => modules.map((m) => `${tt(`modulesShort.${m}`)} ${format.number(r.submitted[m] ?? 0)}/${format.number(r.students)}`).join(" · "),
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (r) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setResults(r)} aria-label={t("resultsFor", { batch: r.section.name })}>
            {t("results")}
          </Button>
          {modules.includes("WRITING") ? (
            <Link href={`/ielts/assignments/${r.id}/similarity`} aria-label={t("plagiarismFor", { batch: r.section.name })}>
              {t("plagiarism")}
            </Link>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={t("changeFor", { batch: r.section.name })}>
            {t("change")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRemoving(r)} aria-label={t("removeFor", { batch: r.section.name })}>
            {t("remove")}
          </Button>
        </span>
      ),
    },
  ];

  if (testFailed !== null) return <ErrorState title={testFailed === 403 ? tt("notAvailable") : t("loadFailed")} />;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={test ? t("title", { test: test.title }) : t("titleLoading")}
        description={t("description")}
        actions={
          <Button disabled={test?.status !== "PUBLISHED"} onClick={() => setEditing("new")}>
            {t("open")}
          </Button>
        }
      />
      {test && test.status !== "PUBLISHED" ? <p className="text-body-sm text-ink-muted">{t("publishFirst")}</p> : null}
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : !rows ? (
        <Card aria-busy="true">
          <Skeleton lines={3} />
        </Card>
      ) : (
        <Table caption={t("caption")} columns={columns} rows={rows} getRowId={(r) => r.id} empty={<EmptyState title={t("none")} description={t("noneHint")} />} />
      )}
      {editing ? (
        <OpeningDrawer
          testId={testId}
          opening={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            triggerToast({ title: t("saved"), type: "success" });
            reload();
          }}
        />
      ) : null}
      {results ? <ResultsDrawer opening={results} modules={modules} onClose={() => setResults(null)} /> : null}
      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        description={t("removeDescription", { batch: removing?.section.name ?? "" })}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        tone="danger"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const row = removing;
          setRemoving(null);
          if (row) void remove(row);
        }}
      />
    </div>
  );
};

/** A batch and the window, in the centre's time (Asia/Dhaka). */
const OpeningDrawer = ({ testId, opening, onClose, onSaved }: { testId: string; opening: IeltsAssignment | null; onClose: () => void; onSaved: () => void }) => {
  const t = useTranslations("ieltsOpenings");
  const { handleError } = useApiError();
  const { data: sections } = useApiData<ClassSection[]>("/sections");
  const { data: courses } = useApiData<Class[]>("/classes");
  const courseName = new Map((courses ?? []).map((c) => [c.id, c.class_name]));
  const opens = toZonedParts(opening?.opens_at);
  const closes = toZonedParts(opening?.closes_at);
  const [sectionId, setSectionId] = useState(opening?.section.id ?? "");
  const [openDate, setOpenDate] = useState(opens.date);
  const [openTime, setOpenTime] = useState(opens.time || "09:00");
  const [closeDate, setCloseDate] = useState(closes.date);
  const [closeTime, setCloseTime] = useState(closes.time || "17:00");
  const [busy, setBusy] = useState(false);
  const ready = (opening || sectionId) && openDate && closeDate;

  const save = async () => {
    setBusy(true);
    const window = { opens_at: fromZonedParts(openDate, openTime), closes_at: fromZonedParts(closeDate, closeTime) };
    try {
      if (opening) await axiosReq.patch(`${BASE}/ielts/assignments/${opening.id}`, window);
      else await axiosReq.post(`${BASE}/ielts/tests/${testId}/assignments`, { section_id: sectionId, ...window });
      onSaved();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={opening ? t("changeTitle", { batch: opening.section.name }) : t("open")}
      description={t("timeZoneNote")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} disabled={!ready} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!opening ? (
          <Select
            label={t("batch")}
            placeholder={t("chooseBatch")}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            options={(sections ?? []).map((s) => ({ value: s.id, label: `${courseName.get(s.class_id) ?? ""} ${s.name}`.trim() }))}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label={t("opensOn")} value={openDate} onChange={setOpenDate} />
          <TimePicker label={t("opensAt")} value={openTime} onChange={setOpenTime} />
          <DatePicker label={t("closesOn")} value={closeDate} onChange={setCloseDate} min={openDate || undefined} />
          <TimePicker label={t("closesAt")} value={closeTime} onChange={setCloseTime} />
        </div>
      </div>
    </Drawer>
  );
};

/** Each student of the batch with the raw score and band per module. */
const ResultsDrawer = ({ opening, modules, onClose }: { opening: IeltsAssignment; modules: IeltsModule[]; onClose: () => void }) => {
  const t = useTranslations("ieltsOpenings");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const router = useRouter();
  const { handleError } = useApiError();
  /** Starts (or resumes) a live Speaking session and opens the examiner screen. */
  const examine = async (studentId: string) => {
    try {
      const res = await axiosReq.post<{ payload: IeltsMarkingView }>(`${BASE}/ielts/assignments/${opening.id}/speaking`, { student_id: studentId });
      router.push(`/ielts/speaking/${res.data.payload.attempt_id}`);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    }
  };
  const { data: rows, failed, reload } = useApiData<IeltsResultRow[]>(`/ielts/assignments/${opening.id}/results`);
  const cell = (r: IeltsResultRow, m: IeltsModule) => {
    const a = r.modules[m];
    const examineButton = (label: string) => (
      <Button size="sm" variant="secondary" onClick={() => void examine(r.student.id)} aria-label={t("examineFor", { name: r.student.full_name })}>
        {label}
      </Button>
    );
    if (!a) return m === "SPEAKING" ? examineButton(t("examine")) : <span className="text-ink-muted">{t("notStarted")}</span>;
    if (a.status === "IN_PROGRESS") return m === "SPEAKING" && a.mode === "LIVE" ? examineButton(t("continueExam")) : <span className="text-ink-muted">{t("inProgress")}</span>;
    if (a.band === null) {
      return m === "SPEAKING" || m === "WRITING" ? (
        <Button size="sm" variant="ghost" onClick={() => router.push(m === "SPEAKING" ? `/ielts/speaking/${a.attempt_id}` : `/ielts/marking/${a.attempt_id}`)}>
          {t("markNow")}
        </Button>
      ) : (
        t("waitingForMarks")
      );
    }
    return `${format.number(a.band, { minimumFractionDigits: 1 })}${a.raw_score === null ? "" : ` (${format.number(a.raw_score)}/${format.number(a.raw_total ?? 40)})`}`;
  };
  const columns: TableColumn<IeltsResultRow>[] = [
    {
      key: "name",
      header: t("student"),
      cell: (r) => (
        <Link href={`/ielts/report/${opening.id}/${r.student.id}`} aria-label={t("reportFor", { name: r.student.full_name })}>
          {r.student.full_name}
        </Link>
      ),
      sortValue: (r) => r.student.full_name,
    },
    ...modules.map((m) => ({ key: m, header: tt(`modulesShort.${m}`), cell: (r: IeltsResultRow) => cell(r, m), sortValue: (r: IeltsResultRow) => r.modules[m]?.band ?? -1 })),
    ...(modules.length === 4
      ? [{ key: "overall", header: t("overall"), align: "right" as const, cell: (r: IeltsResultRow) => (r.overall === null || r.overall === undefined ? "—" : <strong>{format.number(r.overall, { minimumFractionDigits: 1 })}</strong>), sortValue: (r: IeltsResultRow) => r.overall ?? -1 }]
      : []),
  ];
  return (
    <Drawer open onClose={onClose} title={t("resultsTitle", { batch: opening.section.name })}>
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : !rows ? (
        <Skeleton lines={4} />
      ) : (
        <Table caption={t("resultsCaption")} columns={columns} rows={rows} getRowId={(r) => r.student.id} empty={<EmptyState title={t("noStudents")} />} />
      )}
    </Drawer>
  );
};

export default TestOpenings;
