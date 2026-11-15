"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ErrorState, PageHeader, RadioGroup, Skeleton, StatusPill, Textarea } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { LEVEL_TONE } from "./SimilarityReport";

/** A text with its matching passages marked. */
const Marked = ({ text, spans }: { text: string; spans: { start: number; end: number }[] }) => {
  const pieces: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start > at) pieces.push({ text: text.slice(at, span.start), marked: false });
    pieces.push({ text: text.slice(span.start, span.end), marked: true });
    at = span.end;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), marked: false });
  return (
    <p className="whitespace-pre-line text-body-sm leading-7 text-ink">
      {pieces.map((p, i) => (p.marked ? <mark key={i} className="rounded-sm bg-warning-soft text-ink">{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </p>
  );
};

/**
 * Two submissions side by side with the matching passages marked (PLG-01), and the teacher's
 * review: "Reviewed — OK" or "Copied", with a note (PLG-02). Nothing changes a score by itself.
 */
const MatchReview = ({ matchId }: { matchId: string }) => {
  const t = useTranslations("plagiarism");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data, failed, reload, setData } = useApiData<SimilarityMatchView>(`/integrity/matches/${matchId}`);
  const [decision, setDecision] = useState<"OK" | "COPIED" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (failed !== null) return <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={8} />
      </Card>
    );
  }
  const chosen = decision ?? data.review_decision;
  const written = note ?? data.review_note ?? "";

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const res = await axiosReq.put<{ payload: SimilarityMatchView }>(`${process.env.NEXT_PUBLIC_BASE_URL}/integrity/matches/${matchId}/review`, { decision: chosen, note: written || undefined });
      setData(res.data.payload);
      triggerToast({ title: t("reviewSaved"), type: "success" });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("matchTitle", { a: data.a.student.full_name, b: data.b.student.full_name })}
        description={<StatusPill tone={LEVEL_TONE[data.level]}>{`${t(`levels.${data.level}`)} · ${format.number(data.score)}%`}</StatusPill>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {[data.a, data.b].map((side) => (
          <Card key={side.student.id} title={side.student.full_name} description={t("sharePercent", { percent: side.percent })}>
            <section aria-label={t("textOf", { name: side.student.full_name })}>
              <Marked text={side.text} spans={side.spans} />
            </section>
          </Card>
        ))}
      </div>
      <Card title={t("review")}>
        <div className="flex flex-col gap-4">
          <RadioGroup
            legend={t("decision")}
            name="similarity-decision"
            inline
            value={chosen}
            onChange={(value) => setDecision(value as "OK" | "COPIED")}
            options={(["OK", "COPIED"] as const).map((v) => ({ value: v, label: t(`decisions.${v}`) }))}
          />
          <Textarea label={t("note")} value={written} onChange={(e) => setNote(e.target.value)} rows={3} />
          <p className="text-xs text-ink-muted">{t("noScoreChange")}</p>
          <div>
            <Button loading={busy} disabled={!chosen} onClick={() => void save()}>
              {t("saveReview")}
            </Button>
          </div>
          {data.reviewed_at ? <p className="text-body-sm text-ink-muted">{t("reviewedAt", { when: format.dateTime(data.reviewed_at) })}</p> : null}
        </div>
      </Card>
    </div>
  );
};

export default MatchReview;
