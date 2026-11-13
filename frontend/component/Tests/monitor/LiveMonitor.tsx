"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Drawer, EmptyState, ErrorState, Input, PageHeader, Skeleton, StatusPill, Textarea, type BadgeTone } from "@/design/ui";
import { cn, focusRing } from "@/design/ui/cn";
import { useApiError } from "@/hooks/api/useApiError";
import useMonitorSocket from "@/hooks/tests/proctoring/useMonitorSocket";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const STATUS_TONE: Record<MonitorLiveStatus, BadgeTone> = { WRITING: "success", SUBMITTED: "neutral", ENDED: "danger", DISCONNECTED: "warning", LOST: "danger" };
/** Risk colour of a tile by flag count (PRO-03): none, a few, many. */
const riskOf = (flags: number): "none" | "some" | "high" => (flags >= 5 ? "high" : flags >= 1 ? "some" : "none");
const RISK_CLASS = { none: "border-border", some: "border-warning", high: "border-danger" } as const;

/** A clock that ticks every second, for time left. */
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
};

/**
 * The live monitor (P8-03, PRO-03, PRO-07, PRO-08): a tile per student taking the exam with
 * status (writing, submitted, ended, disconnected, monitoring lost), time left, flags and the
 * latest flag, coloured by risk; a tile opens the student's timeline, where the teacher sends a
 * warning or ends that student's exam with a reason. Alerts appear as they come.
 */
const LiveMonitor = ({ examId }: { examId: string }) => {
  const t = useTranslations("monitor");
  const format = useFormat();
  const now = useNow();
  const { triggerToast } = useToast();
  const { sessions, failed, connected, alerts, reload, patch } = useMonitorSocket(examId);
  const { data: exam } = useApiData<{ test_name: string }>(`/exams/${examId}`);
  const [openId, setOpenId] = useState<string | null>(null);

  const latestAlert = alerts[0];
  useEffect(() => {
    if (latestAlert) triggerToast({ title: t("alertTitle", { name: latestAlert.studentName }), description: t("alertDetail", { count: latestAlert.flagCount }), type: "warning" });
  }, [latestAlert, t, triggerToast]);

  const counts = useMemo(() => {
    const all = sessions ?? [];
    return { writing: all.filter((s) => s.liveStatus === "WRITING").length, lost: all.filter((s) => s.liveStatus === "LOST").length, done: all.filter((s) => s.liveStatus === "SUBMITTED" || s.liveStatus === "ENDED").length };
  }, [sessions]);

  const timeLeft = (deadline?: string | null) => {
    if (!deadline) return "—";
    const seconds = Math.max(0, Math.round((Date.parse(deadline) - now) / 1000));
    return t("timeLeft", { clock: format.clock(seconds) });
  };
  const open = sessions?.find((s) => s.studentId === openId) ?? null;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={[exam?.test_name, connected ? t("live") : t("connecting")].filter(Boolean).join(" · ")}
        actions={
          <Button variant="secondary" onClick={reload}>
            {t("refresh")}
          </Button>
        }
      />
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAllowed") : t("loadFailed")} onRetry={reload} />
      ) : !sessions ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <>
          <p className="text-body-sm text-ink-muted" aria-live="polite">
            {t("summary", { writing: counts.writing, lost: counts.lost, done: counts.done })}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("tilesLabel")}>
            {sessions.map((session) => (
              <li key={session.studentId}>
                <button
                  type="button"
                  onClick={() => setOpenId(session.studentId)}
                  className={cn("flex w-full flex-col gap-2 rounded-card border-2 bg-surface p-4 text-left shadow-card", RISK_CLASS[riskOf(session.flagCount)], focusRing)}
                  aria-label={t("tileLabel", { name: session.studentName, status: t(`status.${session.liveStatus}`), count: session.flagCount })}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-ink">{session.studentName}</span>
                    <StatusPill tone={STATUS_TONE[session.liveStatus]}>{t(`status.${session.liveStatus}`)}</StatusPill>
                  </span>
                  <span className="flex items-center justify-between text-body-sm text-ink-muted">
                    <span>{session.liveStatus === "WRITING" || session.liveStatus === "LOST" || session.liveStatus === "DISCONNECTED" ? timeLeft(session.deadline) : "—"}</span>
                    <span>{t("flags", { count: session.flagCount })}</span>
                  </span>
                  <span className="truncate text-caption text-ink-muted">{session.latestFlag ? t(`events.${session.latestFlag.type}` as never) : t("noFlags")}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <StudentDrawer
        examId={examId}
        session={open}
        onClose={() => setOpenId(null)}
        onEnded={(studentId) => {
          patch(studentId, { liveStatus: "ENDED" });
          setOpenId(null);
        }}
      />
    </div>
  );
};

/** One student: the timeline of flags and events, a warning, or ending their exam. */
const StudentDrawer = ({ examId, session, onClose, onEnded }: { examId: string; session: MonitorSession | null; onClose: () => void; onEnded: (studentId: string) => void }) => {
  const t = useTranslations("monitor");
  return (
    <Drawer open={Boolean(session)} onClose={onClose} title={session?.studentName ?? ""} description={session ? t(`status.${session.liveStatus}`) : undefined}>
      {session ? <StudentPanel key={session.studentId} examId={examId} session={session} onEnded={onEnded} /> : null}
    </Drawer>
  );
};

const StudentPanel = ({ examId, session, onEnded }: { examId: string; session: MonitorSession; onEnded: (studentId: string) => void }) => {
  const t = useTranslations("monitor");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const path = `/exams/${examId}/proctoring/students/${session.studentId}`;
  const { data: timeline, reload } = useApiData<MonitorTimelineEvent[]>(`${path}/timeline`);
  const [warning, setWarning] = useState("");
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // New flags or a status change: read the timeline again.
  useEffect(() => {
    reload();
  }, [session.flagCount, session.liveStatus, reload]);

  const send = async (action: "warn" | "end", body: Record<string, string>, done: string) => {
    setBusy(true);
    try {
      await axiosReq.post(`${process.env.NEXT_PUBLIC_BASE_URL}${path}/${action}`, body);
      triggerToast({ title: done, type: "success" });
      if (action === "end") onEnded(session.studentId);
      else {
        setWarning("");
        reload();
      }
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };
  const writing = session.liveStatus === "WRITING" || session.liveStatus === "LOST" || session.liveStatus === "DISCONNECTED";

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="timeline-title" className="flex flex-col gap-2">
        <h2 id="timeline-title" className="text-body-sm font-semibold text-ink">
          {t("timeline")}
        </h2>
        {!timeline ? (
          <Skeleton lines={3} />
        ) : timeline.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("noFlags")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-body-sm">
            {timeline.map((event) => (
              <li key={event.id} className="flex gap-3">
                <time className="w-20 shrink-0 text-ink-muted" dateTime={event.occurred_at}>
                  {format.date(event.occurred_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
                <span className={event.source === "SERVER" ? "font-medium text-ink" : "text-ink"}>
                  {t(`events.${event.type}` as never)}
                  {event.type.startsWith("teacher-") && event.message ? `: ${event.message}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {writing ? (
        <>
          <div className="flex flex-col gap-2">
            <Textarea label={t("warnLabel")} rows={2} maxLength={300} value={warning} onChange={(event) => setWarning(event.target.value)} placeholder={t("warnPlaceholder")} />
            <Button className="self-end" variant="secondary" loading={busy} disabled={!warning.trim()} onClick={() => void send("warn", { message: warning }, t("warned"))}>
              {t("warn")}
            </Button>
          </div>
          {ending ? (
            <div className="flex flex-col gap-2 rounded-card border border-danger p-3">
              <Input label={t("endReason")} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} hint={t("endHint")} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEnding(false)}>
                  {t("cancel")}
                </Button>
                <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => void send("end", { reason }, t("ended"))}>
                  {t("endConfirm")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="self-start text-danger" onClick={() => setEnding(true)}>
              {t("end")}
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
};

export default LiveMonitor;
