"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Drawer, ErrorState, PageHeader, RadioGroup, Skeleton, StatTile, StatusPill, Table, Textarea, type BadgeTone, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const STATUS_TONE: Record<string, BadgeTone> = { SUBMITTED: "success", AUTO_SUBMITTED: "neutral", DISQUALIFIED: "danger", IN_PROGRESS: "info" };
const KNOWN_STATUSES = ["SUBMITTED", "AUTO_SUBMITTED", "DISQUALIFIED", "IN_PROGRESS"];

/** A check's name from the plan catalogue; flags that belong to no check are "other". */
const useCheckName = () => {
  const t = useTranslations("integrity");
  const catalog = useTranslations("features.catalog");
  return (check: string) => (catalog.has(`${check}.name` as never) ? catalog(`${check}.name` as never) : t("otherCheck"));
};

/**
 * The integrity report (P8-04, PRO-04, PRO-05): flags by check, every student who took the exam
 * with flags, result and the latest review, most flagged first; a student opens their report
 * (timeline, earlier reviews) and the teacher's decision: reinstate, retake or confirm, with a
 * reason. Printed by the browser.
 */
const IntegrityReport = ({ examId }: { examId: string }) => {
  const t = useTranslations("integrity");
  const format = useFormat();
  const checkName = useCheckName();
  const { data: exam } = useApiData<{ test_name: string }>(`/exams/${examId}`);
  const { data: report, failed, reload } = useApiData<IntegrityReport>(`/exams/${examId}/proctoring/integrity`);
  const [openId, setOpenId] = useState<string | null>(null);
  const statusLabel = (status: string) => (KNOWN_STATUSES.includes(status) ? t(`status.${status}` as never) : status);
  const open = report?.students.find((row) => row.student_id === openId) ?? null;

  const columns: TableColumn<IntegrityStudentRow>[] = [
    { key: "name", header: t("student"), cell: (row) => <span className="font-medium text-ink">{row.student_name}</span>, sortValue: (row) => row.student_name },
    { key: "status", header: t("result"), cell: (row) => <StatusPill tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</StatusPill>, sortValue: (row) => row.status },
    {
      key: "score",
      header: t("score"),
      align: "right",
      cell: (row) => (row.total_score === null ? "—" : t("scoreOf", { score: row.total_score, max: row.max_score ?? 0 })),
      sortValue: (row) => row.total_score,
    },
    { key: "flags", header: t("flags"), align: "right", cell: (row) => format.number(row.flags), sortValue: (row) => row.flags },
    {
      key: "checks",
      header: t("mostFlagged"),
      hideOnMobile: true,
      cell: (row) => (row.checks.length ? row.checks.slice(0, 2).map((c) => `${checkName(c.check)} (${format.number(c.count)})`).join(", ") : "—"),
    },
    { key: "review", header: t("review"), cell: (row) => (row.last_review ? t(`decision.${row.last_review.decision}`) : "—"), sortValue: (row) => row.last_review?.decision },
    {
      key: "open",
      header: t("actions"),
      align: "right",
      cell: (row) => (
        <Button size="sm" variant="secondary" className="print:hidden" onClick={() => setOpenId(row.student_id)} aria-label={t("openFor", { name: row.student_name })}>
          {t("open")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={exam?.test_name}
        actions={
          <Button variant="secondary" className="print:hidden" onClick={() => window.print()} disabled={!report}>
            {t("print")}
          </Button>
        }
      />
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAllowed") : t("loadFailed")} onRetry={reload} />
      ) : !report ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label={t("students")} value={report.summary.students} />
            <StatTile label={t("flagged")} value={report.summary.flagged} />
            <StatTile label={t("disqualified")} value={report.summary.disqualified} />
            <StatTile label={t("reviewed")} value={report.summary.reviewed} />
          </div>
          <Card>
            <h2 className="mb-3 text-body font-semibold text-ink">{t("byCheck")}</h2>
            {report.by_check.length === 0 ? (
              <p className="text-body-sm text-ink-muted">{t("noFlags")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-body-sm" aria-label={t("byCheck")}>
                {report.by_check.map((row) => (
                  <li key={row.check} className="flex justify-between gap-3">
                    <span className="text-ink">{checkName(row.check)}</span>
                    <span className="text-ink-muted">{t("checkCount", { count: row.count, students: row.students })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Table caption={t("tableCaption")} columns={columns} rows={report.students} getRowId={(row) => row.student_id} empty={<p className="p-4 text-body-sm text-ink-muted">{t("empty")}</p>} />
        </>
      )}
      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.student_name ?? ""} description={open ? statusLabel(open.status) : undefined}>
        {open ? (
          <StudentReview
            key={open.student_id}
            examId={examId}
            row={open}
            onDecided={() => {
              reload();
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

/** One student's report and the review form. */
const StudentReview = ({ examId, row, onDecided }: { examId: string; row: IntegrityStudentRow; onDecided: () => void }) => {
  const t = useTranslations("integrity");
  const events = useTranslations("monitor.events");
  const format = useFormat();
  const checkName = useCheckName();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const path = `/exams/${examId}/proctoring/students/${row.student_id}`;
  const { data: report, reload } = useApiData<StudentIntegrityReport>(`${path}/report`);
  const [decision, setDecision] = useState<AttemptReviewDecision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const finished = row.status !== "IN_PROGRESS";

  const options = [
    ...(row.status === "DISQUALIFIED" ? [{ value: "REINSTATE", label: t("decision.REINSTATE"), hint: t("decisionHint.REINSTATE") }] : []),
    { value: "RETAKE", label: t("decision.RETAKE"), hint: t("decisionHint.RETAKE") },
    { value: "CONFIRM", label: t("decision.CONFIRM"), hint: t("decisionHint.CONFIRM") },
  ];

  const submit = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await axiosReq.post(`${process.env.NEXT_PUBLIC_BASE_URL}${path}/review`, { decision, reason });
      triggerToast({ title: t("saved"), type: "success" });
      setDecision(null);
      setReason("");
      reload();
      onDecided();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  if (!report) return <Skeleton lines={4} />;
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-2 text-body-sm">
        <dt className="text-ink-muted">{t("score")}</dt>
        <dd className="text-ink">{report.attempt.total_score === null ? "—" : t("scoreOf", { score: report.attempt.total_score, max: report.attempt.max_score ?? 0 })}</dd>
        {report.attempt.disqualification_reason ? (
          <>
            <dt className="text-ink-muted">{t("why")}</dt>
            <dd className="text-ink">{report.attempt.disqualification_reason}</dd>
          </>
        ) : null}
      </dl>
      <section aria-labelledby="checks-title" className="flex flex-col gap-1.5">
        <h2 id="checks-title" className="text-body-sm font-semibold text-ink">
          {t("byCheck")}
        </h2>
        {report.checks.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("noFlags")}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-body-sm">
            {report.checks.map((c) => (
              <li key={c.check} className="flex justify-between gap-3">
                <span>{checkName(c.check)}</span>
                <span className="text-ink-muted">{format.number(c.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="timeline-title" className="flex flex-col gap-1.5">
        <h2 id="timeline-title" className="text-body-sm font-semibold text-ink">
          {t("timeline")}
        </h2>
        {report.timeline.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("noFlags")}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-body-sm">
            {report.timeline.map((event) => (
              <li key={event.id} className="flex gap-3">
                <time className="w-20 shrink-0 text-ink-muted" dateTime={event.occurred_at}>
                  {format.date(event.occurred_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
                <span className={event.source === "SERVER" ? "font-medium text-ink" : "text-ink"}>
                  {events.has(event.type as never) ? events(event.type as never) : event.type}
                  {event.type.startsWith("teacher-") && event.message ? `: ${event.message}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {report.reviews.length ? (
        <section aria-labelledby="reviews-title" className="flex flex-col gap-1.5">
          <h2 id="reviews-title" className="text-body-sm font-semibold text-ink">
            {t("history")}
          </h2>
          <ul className="flex flex-col gap-2 text-body-sm">
            {report.reviews.map((r) => (
              <li key={r.id} className="rounded-card border border-border p-2">
                <p className="font-medium text-ink">
                  {t(`decision.${r.decision}`)} · {format.date(r.decided_at, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="text-ink-muted">{t("decidedBy", { name: r.decided_by_name ?? "—", reason: r.reason })}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {finished ? (
        <section className="flex flex-col gap-3 print:hidden" aria-labelledby="decide-title">
          <h2 id="decide-title" className="text-body-sm font-semibold text-ink">
            {t("decide")}
          </h2>
          <RadioGroup legend={t("decisionLegend")} name={`decision-${row.student_id}`} options={options} value={decision} onChange={(value) => setDecision(value as AttemptReviewDecision)} />
          <Textarea label={t("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} hint={t("reasonHint")} />
          <Button className="self-end" loading={busy} disabled={!decision || !reason.trim()} onClick={() => void submit()}>
            {t("save")}
          </Button>
        </section>
      ) : (
        <p className="text-body-sm text-ink-muted">{t("writing")}</p>
      )}
    </div>
  );
};

export default IntegrityReport;
