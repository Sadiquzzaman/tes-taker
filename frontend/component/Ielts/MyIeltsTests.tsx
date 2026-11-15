"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

/** Modules taken on screen (Speaking is a session with the examiner, P10-06). */
const ON_SCREEN: IeltsModule[] = ["LISTENING", "READING", "WRITING"];
/** A mock's modules run in this order. */
const SEQUENCE: IeltsModule[] = ["LISTENING", "READING", "WRITING"];

/**
 * A student's IELTS tests (P10-04): what is opened for their batches, with each module's state —
 * start (after a reminder of the time), continue, or the band.
 */
const MyIeltsTests = () => {
  const t = useTranslations("ieltsTake");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const router = useRouter();
  const { handleError } = useApiError();
  const { data: rows, failed, reload } = useApiData<IeltsMyAssignment[]>("/ielts/my/assignments");
  const [starting, setStarting] = useState<{ row: IeltsMyAssignment; module: IeltsModule } | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (row: IeltsMyAssignment, module: IeltsModule) => {
    setBusy(true);
    try {
      const res = await axiosReq.post<{ payload: IeltsAttemptView }>(`${process.env.NEXT_PUBLIC_BASE_URL}/ielts/my/assignments/${row.id}/modules/${module}/start`);
      router.push(`/ielts/attempts/${res.data.payload.attempt.id}`);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
      setBusy(false);
      reload();
    }
  };

  /** A mock's earlier modules must be handed in first. */
  const waiting = (row: IeltsMyAssignment, module: IeltsModule) =>
    row.test.purpose === "MOCK" &&
    SEQUENCE.slice(0, SEQUENCE.indexOf(module)).some((m) => row.test.modules.includes(m) && !["SUBMITTED", "MARKED"].includes(row.attempts[m]?.status ?? ""));

  const action = (row: IeltsMyAssignment, module: IeltsModule) => {
    const attempt = row.attempts[module];
    if (attempt?.status === "IN_PROGRESS") {
      return (
        <Button size="sm" onClick={() => router.push(`/ielts/attempts/${attempt.id}`)}>
          {t("continue")}
        </Button>
      );
    }
    if (attempt) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-body-sm text-ink">
            {attempt.band === null ? t("waitingForMarks") : t("bandShort", { band: format.number(attempt.band, { minimumFractionDigits: 1 }) })}
          </span>
          <Button size="sm" variant="ghost" onClick={() => router.push(`/ielts/attempts/${attempt.id}`)}>
            {t("viewResult")}
          </Button>
        </span>
      );
    }
    if (!ON_SCREEN.includes(module)) return <span className="text-body-sm text-ink-muted">{t("notOnScreenYet")}</span>;
    if (!row.is_open) return <span className="text-body-sm text-ink-muted">{t("notOpen")}</span>;
    if (waiting(row, module)) return <span className="text-body-sm text-ink-muted">{t("afterPrevious")}</span>;
    return (
      <Button size="sm" disabled={busy} onClick={() => setStarting({ row, module })}>
        {t("start")}
      </Button>
    );
  };

  const minutes = starting ? Math.round(((starting.row.test.durations[starting.module] ?? 0) + (starting.module === "LISTENING" ? 120 : 0)) / 60) : 0;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("myTitle")} description={t("myDescription")} />
      {failed !== null ? (
        <ErrorState title={failed === 403 ? tt("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !rows ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState title={t("noneOpen")} description={t("noneOpenHint")} />
      ) : (
        rows.map((row) => (
          <Card key={row.id}>
            <section aria-label={row.test.title} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-title-sm font-semibold text-ink">{row.test.title}</h2>
                <Badge tone={row.test.purpose === "MOCK" ? "primary" : "info"}>{tt(`purposes.${row.test.purpose}`)}</Badge>
              </div>
              <p className="text-body-sm text-ink-muted">
                {t("window", { from: format.dateTime(row.opens_at), to: format.dateTime(row.closes_at) })}
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {row.test.modules.map((module) => (
                  <li key={module} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-body text-ink">
                      {tt(`modulesShort.${module}`)}
                      <span className="ms-2 text-body-sm text-ink-muted">{t("minutes", { count: Math.round((row.test.durations[module] ?? 0) / 60) })}</span>
                    </span>
                    {action(row, module)}
                  </li>
                ))}
              </ul>
            </section>
          </Card>
        ))
      )}
      <ConfirmDialog
        open={starting !== null}
        title={starting ? t("startTitle", { module: tt(`modulesShort.${starting.module}`) }) : ""}
        description={starting ? (starting.module === "LISTENING" ? t("startListening", { minutes }) : t("startOther", { minutes })) : ""}
        confirmLabel={t("start")}
        cancelLabel={t("notYet")}
        loading={busy}
        onCancel={() => setStarting(null)}
        onConfirm={() => {
          const chosen = starting;
          setStarting(null);
          if (chosen) void start(chosen.row, chosen.module);
        }}
      />
    </div>
  );
};

export default MyIeltsTests;
