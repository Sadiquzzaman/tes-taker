"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button, Card, ConfirmDialog, ErrorState, Link, Spinner, StatTile, cn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import ListeningPlayer from "./ListeningPlayer";
import PaperGroup, { questionAnchor } from "./PaperGroup";
import ReadingPassage from "./ReadingPassage";
import useIeltsAttempt from "./useIeltsAttempt";

/** Mocks need a computer or a tablet (the owner's decision, 15 Nov 2026). */
const MIN_MOCK_WIDTH = 768;

const subscribeToResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Taking an IELTS module in the computer-delivered layout (P10-04, IEL-04, IEL-05): the timer and
 * hand-in on top; Listening plays each part's recording once above its questions; Reading shows
 * the passage and its questions side by side, each scrolling on its own; the 1–40 navigator at
 * the bottom shows what is answered and flagged. After hand-in: the raw score and band, and the
 * answers when they may be shown.
 */
const IeltsAttemptScreen = ({ attemptId }: { attemptId: string }) => {
  const t = useTranslations("ieltsTake");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const { view, failed, reload, answers, setAnswer, saveStatus, remaining, submit, submitting } = useIeltsAttempt(attemptId);
  const [partIndex, setPartIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const narrow = useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth < MIN_MOCK_WIDTH,
    () => false,
  );

  const parts = useMemo(() => view?.parts ?? [], [view]);
  const questions = useMemo(() => parts.flatMap((p, index) => p.groups.flatMap((g) => g.questions.map((q) => ({ ...q, partIndex: index })))), [parts]);

  if (failed !== null) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState title={failed === 404 ? t("notFound") : t("loadFailed")} onRetry={reload} />
      </div>
    );
  }
  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <Spinner />
      </div>
    );
  }
  if (view.attempt.status !== "IN_PROGRESS") return <ResultView view={view} answers={answers} />;
  if (narrow && view.test.purpose === "MOCK") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-body text-ink">{t("needComputer")}</p>
        <Link href="/ielts/my">{t("backToTests")}</Link>
      </div>
    );
  }

  const part = parts[Math.min(partIndex, parts.length - 1)];
  const answered = (q: IeltsPaperQuestion) => !!answers[q.id];
  const unanswered = questions.filter((q) => !answered(q)).reduce((n, q) => n + (q.number_to - q.number_from + 1), 0);
  const toggleFlag = (id: string) => setFlagged((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const low = remaining !== null && remaining <= 5 * 60;
  const groups = part ? (
    <div className="flex flex-col gap-8">
      {part.groups.map((g) => (
        <PaperGroup key={g.id} group={g} answers={answers} onAnswer={setAnswer} readOnly={false} flagged={flagged} onFlag={toggleFlag} />
      ))}
    </div>
  ) : null;

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <div className="flex flex-col">
          <span className="text-body-sm text-ink-muted">{view.test.title}</span>
          <span className="text-body font-semibold text-ink">{tt(`modulesShort.${view.attempt.module}`)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-ink-muted" aria-live="polite">
            {saveStatus === "saving" ? t("saving") : saveStatus === "saved" ? t("saved") : saveStatus === "error" ? t("saveFailed") : ""}
          </span>
          <span role="timer" aria-label={t("timeLeft")} className={cn("font-mono text-title-sm font-semibold", low ? "text-danger" : "text-ink")}>
            {remaining === null ? "--:--" : clock(remaining)}
          </span>
          <Button loading={submitting} onClick={() => setConfirm(true)}>
            {t("handIn")}
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {part ? (
          view.attempt.module === "READING" ? (
            <div className="grid h-full grid-cols-1 md:grid-cols-2">
              <section aria-label={t("passage")} className="overflow-y-auto border-border p-4 md:border-e">
                <ReadingPassage attemptId={view.attempt.id} part={part} />
              </section>
              <section aria-label={t("questions")} className="overflow-y-auto p-4">
                {groups}
              </section>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <h2 className="text-title-sm font-semibold text-ink">{tt(`partNames.${part.module}`, { no: part.part_no })}</h2>
                <ListeningPlayer attemptId={view.attempt.id} part={part} />
                {groups}
              </div>
            </div>
          )
        ) : null}
      </main>

      <nav aria-label={t("navigator")} className="flex items-center gap-3 overflow-x-auto border-t border-border bg-surface px-4 py-2">
        {parts.map((p, index) => (
          <div key={p.id} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={cn("rounded-input px-2 py-1 text-body-sm font-medium", index === partIndex ? "bg-primary text-on-primary" : "text-ink hover:bg-canvas")}
              aria-current={index === partIndex ? "step" : undefined}
              onClick={() => setPartIndex(index)}
            >
              {tt(`partNames.${p.module}`, { no: p.part_no })}
            </button>
            {questions
              .filter((q) => q.partIndex === index)
              .flatMap((q) => Array.from({ length: q.number_to - q.number_from + 1 }, (_, i) => ({ q, n: q.number_from + i })))
              .map(({ q, n }) => (
                <button
                  key={n}
                  type="button"
                  aria-label={t("goTo", { number: n, state: flagged.has(q.id) ? "flagged" : answered(q) ? "answered" : "open" })}
                  className={cn(
                    "h-7 w-7 rounded-input border text-xs",
                    flagged.has(q.id) ? "border-warning bg-warning-soft text-warning" : answered(q) ? "border-primary bg-primary-soft text-primary" : "border-border text-ink",
                  )}
                  onClick={() => {
                    setPartIndex(index);
                    // After the part has rendered.
                    requestAnimationFrame(() => document.getElementById(questionAnchor(q.number_from))?.scrollIntoView({ block: "center" }));
                  }}
                >
                  {format.number(n)}
                </button>
              ))}
          </div>
        ))}
      </nav>

      <ConfirmDialog
        open={confirm}
        title={t("handInTitle")}
        description={unanswered ? t("handInUnanswered", { count: unanswered }) : t("handInAll")}
        confirmLabel={t("handIn")}
        cancelLabel={t("keepWorking")}
        loading={submitting}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void submit();
        }}
      />
    </div>
  );
};

/** After hand-in: score out of 40 and band; each answer with the right one when they may be shown. */
const ResultView = ({ view, answers }: { view: IeltsAttemptView; answers: Record<string, string> }) => {
  const t = useTranslations("ieltsTake");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const none = () => undefined;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-10">
      <div className="flex flex-col gap-1">
        <span className="text-body-sm text-ink-muted">{view.test.title}</span>
        <h1 className="text-title font-semibold text-ink">{t("resultTitle", { module: tt(`modulesShort.${view.attempt.module}`) })}</h1>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatTile label={t("rawScore")} value={view.attempt.raw_score === null ? "—" : t("outOf40", { score: view.attempt.raw_score })} />
        <StatTile label={t("band")} value={view.attempt.band === null ? "—" : format.number(view.attempt.band, { minimumFractionDigits: 1 })} />
      </div>
      {view.parts ? (
        view.parts.map((p) => (
          <Card key={p.id}>
            <h2 className="mb-4 text-title-sm font-semibold text-ink">{tt(`partNames.${p.module}`, { no: p.part_no })}</h2>
            <div className="flex flex-col gap-8">
              {p.groups.map((g) => (
                <PaperGroup key={g.id} group={g} answers={answers} onAnswer={none} readOnly flagged={new Set()} onFlag={none} />
              ))}
            </div>
          </Card>
        ))
      ) : (
        <p className="text-body-sm text-ink-muted">{t("answersLater")}</p>
      )}
      <Link href="/ielts/my">{t("backToTests")}</Link>
    </div>
  );
};

export default IeltsAttemptScreen;
