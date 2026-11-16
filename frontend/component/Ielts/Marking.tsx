"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { RichTextContent } from "@/component/RichTextEditor";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, EmptyState, ErrorState, Link, PageHeader, Select, Skeleton, StatTile, Table, Tabs, Textarea, cn, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { BANDS } from "./bands";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

/** Task 1 is judged on Task Achievement, Task 2 on Task Response; both on CC, LR and GRA. */
const CRITERIA: Record<number, string[]> = { 1: ["TA", "CC", "LR", "GRA"], 2: ["TR", "CC", "LR", "GRA"] };

/** Nearest half band: .25 up to .5, .75 up to the next band (as the API works it out). */
const roundBand = (value: number) => Math.round(value * 2 + 1e-9) / 2;

/** IELTS Writing waiting to be marked, or marked (P10-05, IEL-06), for the centre's staff. */
export const MarkingList = () => {
  const t = useTranslations("ieltsMarking");
  const format = useFormat();
  const router = useRouter();
  const [state, setState] = useState<"WAITING" | "MARKED">("WAITING");
  const [module, setModule] = useState<"WRITING" | "SPEAKING">("WRITING");
  const { data: rows, failed, reload } = useApiData<IeltsMarkingRow[]>("/ielts/marking", { state, module });
  const pageOf = (r: IeltsMarkingRow) => (r.module === "SPEAKING" ? `/ielts/speaking/${r.attempt_id}` : `/ielts/marking/${r.attempt_id}`);
  const columns: TableColumn<IeltsMarkingRow>[] = [
    {
      key: "student",
      header: t("student"),
      cell: (r) => (
        <Link href={pageOf(r)} className="font-medium">
          {r.student.full_name}
        </Link>
      ),
      sortValue: (r) => r.student.full_name,
    },
    { key: "batch", header: t("batch"), hideOnMobile: true, cell: (r) => r.batch },
    { key: "test", header: t("test"), cell: (r) => r.test.title },
    { key: "submitted", header: t("handedIn"), hideOnMobile: true, cell: (r) => (r.submitted_at ? format.dateTime(r.submitted_at) : "—"), sortValue: (r) => r.submitted_at },
    { key: "band", header: t("band"), align: "right", cell: (r) => (r.band === null ? "—" : format.number(r.band, { minimumFractionDigits: 1 })) },
    {
      key: "open",
      header: t("actions"),
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="secondary" onClick={() => router.push(pageOf(r))} aria-label={t(module === "SPEAKING" ? "markSpeakingFor" : "markFor", { name: r.student.full_name })}>
          {r.status === "MARKED" ? t("change") : t("mark")}
        </Button>
      ),
    },
  ];
  const table = rows ? (
    <Table
      caption={module === "SPEAKING" ? t("captionSpeaking") : t("caption")}
      columns={columns}
      rows={rows}
      getRowId={(r) => r.attempt_id}
      empty={<EmptyState title={state === "WAITING" ? t("noneWaiting") : t("noneMarked")} />}
    />
  ) : (
    <Card aria-busy="true">
      <Skeleton lines={4} />
    </Card>
  );
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={module === "SPEAKING" ? t("descriptionSpeaking") : t("description")} />
      <Select
        label={t("module")}
        value={module}
        onChange={(e) => setModule(e.target.value as "WRITING" | "SPEAKING")}
        options={(["WRITING", "SPEAKING"] as const).map((m) => ({ value: m, label: t(`modules.${m}`) }))}
        fieldClassName="max-w-xs"
      />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : (
        <Tabs
          selectedKey={state}
          onChange={(key) => setState(key as "WAITING" | "MARKED")}
          tabs={[
            { key: "WAITING", label: t("waiting"), content: state === "WAITING" ? table : null },
            { key: "MARKED", label: t("marked"), content: state === "MARKED" ? table : null },
          ]}
        />
      )}
    </div>
  );
};

/** Marking one Writing attempt: each task and script with its word count, the four criteria, comments and feedback. */
export const MarkWriting = ({ attemptId }: { attemptId: string }) => {
  const t = useTranslations("ieltsMarking");
  const tk = useTranslations("ieltsTake");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: view, failed, reload, setData } = useApiData<IeltsMarkingView>(`/ielts/marking/${attemptId}`);
  const [criteria, setCriteria] = useState<Record<string, Record<string, string>> | null>(null);
  const [comments, setComments] = useState<Record<string, string> | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (failed !== null) return <ErrorState title={failed === 409 ? t("notHandedIn") : t("loadFailed")} onRetry={reload} />;
  if (!view) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }
  const given = criteria ?? Object.fromEntries(view.tasks.map((task) => [task.part_id, Object.fromEntries(Object.entries(view.marks.find((m) => m.part_id === task.part_id)?.criteria ?? {}).map(([k, v]) => [k, String(v)]))]));
  const notes = comments ?? Object.fromEntries(view.tasks.map((task) => [task.part_id, view.marks.find((m) => m.part_id === task.part_id)?.comment ?? ""]));
  const overall = feedback ?? view.feedback ?? "";
  const band = (value: number) => format.number(value, { minimumFractionDigits: 1 });
  const taskBand = (partId: string, partNo: number) => {
    const values = (CRITERIA[partNo] ?? []).map((k) => given[partId]?.[k]);
    return values.every((v) => v !== undefined && v !== "") ? roundBand(values.reduce((sum, v) => sum + Number(v), 0) / values.length) : null;
  };
  const ready = view.tasks.every((task) => taskBand(task.part_id, task.part_no) !== null);
  const options = BANDS.map((b) => ({ value: String(b), label: band(b) }));

  const save = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.put<{ payload: IeltsMarkingView }>(`${BASE}/ielts/marking/${attemptId}/writing`, {
        tasks: view.tasks.map((task) => ({
          part_id: task.part_id,
          criteria: Object.fromEntries((CRITERIA[task.part_no] ?? []).map((k) => [k, Number(given[task.part_id][k])])),
          comment: notes[task.part_id] || undefined,
        })),
        feedback: overall || undefined,
      });
      setData(res.data.payload);
      triggerToast({ title: t("saved"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("markTitle", { name: view.student.full_name })} description={`${view.test.title} · ${view.batch}`} />
      {view.band !== null ? <StatTile label={t("writingBand")} value={band(view.band)} /> : null}
      {view.tasks.map((task) => {
        const tb = taskBand(task.part_id, task.part_no);
        return (
          <Card key={task.part_id}>
            <section aria-label={t("taskN", { no: task.part_no })} className="flex flex-col gap-4">
              <h2 className="text-title-sm font-semibold text-ink">{t("taskN", { no: task.part_no })}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <RichTextContent html={task.content ?? ""} />
                  {task.image_file_id ? (
                    <Image src={`${BASE}/files/${task.image_file_id}/content`} alt={tk("picture")} width={0} height={0} sizes="100vw" unoptimized className="h-auto max-h-72 w-auto self-start rounded-card border border-border" />
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <p className={cn("text-body-sm", task.words < task.min_words ? "text-warning" : "text-ink-muted")}>
                    {tk("wordCount", { count: task.words })}
                    {task.words < task.min_words ? ` · ${tk("underMinimum", { count: task.min_words })}` : ""}
                  </p>
                  <p className="whitespace-pre-line rounded-card border border-border bg-canvas p-3 text-body-sm text-ink">{task.script || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(CRITERIA[task.part_no] ?? []).map((key) => (
                  <Select
                    key={key}
                    label={tk(`criteria.${key}` as "criteria.CC")}
                    placeholder="—"
                    value={given[task.part_id]?.[key] ?? ""}
                    onChange={(e) => setCriteria({ ...given, [task.part_id]: { ...given[task.part_id], [key]: e.target.value } })}
                    options={options}
                  />
                ))}
              </div>
              <p className="text-body-sm font-medium text-ink">{tb === null ? t("taskBandPending") : tk("taskBand", { band: band(tb) })}</p>
              <Textarea label={t("comment")} value={notes[task.part_id] ?? ""} onChange={(e) => setComments({ ...notes, [task.part_id]: e.target.value })} rows={3} />
            </section>
          </Card>
        );
      })}
      <Card>
        <Textarea label={tk("feedback")} value={overall} onChange={(e) => setFeedback(e.target.value)} rows={4} />
        <p className="mt-2 text-xs text-ink-muted">{t("rule")}</p>
        <div className="mt-4">
          <Button loading={busy} disabled={!ready} onClick={() => void save()}>
            {t("saveMarks")}
          </Button>
        </div>
      </Card>
    </div>
  );
};
