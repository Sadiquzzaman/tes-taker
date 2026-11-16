"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, EmptyState, ErrorState, Link, PageHeader, Skeleton, StatusPill, Table, type BadgeTone, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

export const LEVEL_TONE: Record<SimilarityLevel, BadgeTone> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };

type Row = SimilarityReportData["submissions"][number];
type Pair = SimilarityReportData["matches"][number];

/**
 * Plagiarism results (P10-09, PLG-01–03) for a homework or an IELTS opening's Writing: each
 * submission's similarity with the most similar classmates, the pairs with the teacher's review,
 * and Run now. Staff only. Opening it after the due date runs the first check by itself.
 */
const SimilarityReport = ({ scopeType, scopeId, title, back }: { scopeType: SimilarityScope; scopeId: string; title?: string; back: { href: string; label: string } }) => {
  const t = useTranslations("plagiarism");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data, failed, reload, setData } = useApiData<SimilarityReportData>("/integrity/checks/latest", { scope_type: scopeType, scope_id: scopeId });
  const [busy, setBusy] = useState(false);
  const ielts = scopeType === "IELTS_WRITING";

  const run = async () => {
    setBusy(true);
    try {
      const res = await axiosReq.post<{ payload: SimilarityReportData }>(`${process.env.NEXT_PUBLIC_BASE_URL}/integrity/checks`, { scope_type: scopeType, scope_id: scopeId });
      setData(res.data.payload);
      triggerToast({ title: t("ran"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const pct = (value: number) => `${format.number(value)}%`;
  const columns: TableColumn<Row>[] = [
    { key: "student", header: t("student"), cell: (r) => <span className="font-medium text-ink">{r.student.full_name}</span>, sortValue: (r) => r.student.full_name },
    ...(ielts ? [{ key: "task", header: t("task"), cell: (r: Row) => (r.part_no ? t("taskN", { no: r.part_no }) : "—") }] : []),
    { key: "words", header: t("words"), align: "right", hideOnMobile: true, cell: (r) => format.number(r.words) },
    {
      key: "similarity",
      header: t("similarity"),
      cell: (r) =>
        r.not_checked ? (
          <span className="text-body-sm text-ink-muted">{t(`notChecked.${r.not_checked}`)}</span>
        ) : r.level ? (
          <StatusPill tone={LEVEL_TONE[r.level]}>{`${t(`levels.${r.level}`)} · ${pct(r.percent)}`}</StatusPill>
        ) : (
          "—"
        ),
      sortValue: (r) => (r.not_checked ? -1 : r.percent),
    },
    {
      key: "similar",
      header: t("mostSimilar"),
      cell: (r) =>
        r.most_similar.length ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {r.most_similar.map((m) => (
              <Link key={m.match_id} href={`/integrity/matches/${m.match_id}${ielts ? "?from=ielts" : ""}`} aria-label={t("compareWith", { a: r.student.full_name, b: m.student.full_name })}>
                {m.student.full_name} ({pct(m.percent)})
              </Link>
            ))}
          </span>
        ) : (
          "—"
        ),
    },
  ];
  const pairColumns: TableColumn<Pair>[] = [
    {
      key: "pair",
      header: t("pair"),
      cell: (m) => (
        <Link href={`/integrity/matches/${m.id}${ielts ? "?from=ielts" : ""}`}>
          {m.a.student.full_name} · {m.b.student.full_name}
          {m.part_no ? ` · ${t("taskN", { no: m.part_no })}` : ""}
        </Link>
      ),
    },
    { key: "score", header: t("similarity"), cell: (m) => <StatusPill tone={LEVEL_TONE[m.level]}>{`${t(`levels.${m.level}`)} · ${pct(m.score)}`}</StatusPill>, sortValue: (m) => m.score },
    { key: "review", header: t("review"), cell: (m) => (m.review_decision ? t(`decisions.${m.review_decision}`) : <span className="text-ink-muted">{t("notReviewed")}</span>) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={title ? t("title", { name: title }) : t("titlePlain")}
        description={<Link href={back.href}>{back.label}</Link>}
        actions={
          <Button loading={busy} onClick={() => void run()}>
            {t("runNow")}
          </Button>
        }
      />
      <p className="text-body-sm text-ink-muted">{t("staffOnly")}</p>
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !data ? (
        <Card aria-busy="true">
          <Skeleton lines={6} />
        </Card>
      ) : (
        <>
          <p className="text-body-sm text-ink">
            {data.check ? t("lastRun", { when: format.dateTime(data.check.ran_at), count: data.check.submissions }) : t("notRunYet")}
            {" · "}
            {t("thresholds", { high: data.thresholds.high, medium: data.thresholds.medium, words: data.thresholds.min_words })}
          </p>
          <Table caption={t("submissionsCaption")} columns={columns} rows={data.submissions} getRowId={(r) => r.submission_id} empty={<EmptyState title={t("noSubmissions")} />} />
          <Card title={t("pairsTitle")} description={t("pairsDescription")}>
            <Table caption={t("pairsTitle")} columns={pairColumns} rows={data.matches.filter((m) => m.level !== "LOW" || m.review_decision)} getRowId={(m) => m.id} empty={<EmptyState className="py-4" title={t("noPairs")} />} />
          </Card>
        </>
      )}
    </div>
  );
};

export default SimilarityReport;
