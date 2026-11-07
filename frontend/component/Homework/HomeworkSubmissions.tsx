"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  StatTile,
  StatusPill,
  Table,
  Textarea,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { RATING_KEYS, scoreLabel } from "./homeworkFormat";
import useApiData from "./useApiData";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

/** Scoring refusals the screen explains itself (messages `homework.errors`). */
const SCORE_ERRORS = ["HOMEWORK_SCORE_INVALID", "HOMEWORK_STUDENT_NOT_SET", "HOMEWORK_NOT_LATEST", "HOMEWORK_SESSION_CLOSED", "HOMEWORK_WRONG_STATUS"] as const;
type ScoreError = (typeof SCORE_ERRORS)[number];
const isScoreError = (code: unknown): code is ScoreError => (SCORE_ERRORS as readonly unknown[]).includes(code);

const studentName = (row: HomeworkGridRow) => (row.student.roll_no ? `${row.student.roll_no}. ${row.student.full_name}` : row.student.full_name);

/** What a score form holds: text fields while typing, sent as numbers. */
interface ScoreDraft {
  raw_score: string;
  feedback: string;
  is_missing: boolean;
  ratings: HomeworkRatings;
}

const draftOf = (row: HomeworkGridRow): ScoreDraft => ({
  raw_score: row.score?.raw_score === null || row.score?.raw_score === undefined ? "" : String(row.score.raw_score),
  feedback: row.score?.feedback ?? "",
  is_missing: row.score?.is_missing ?? false,
  ratings: row.score?.ratings ?? {},
});

const inputOf = (studentId: string, draft: ScoreDraft, scored: boolean): HomeworkScoreInput => ({
  student_id: studentId,
  ...(scored ? { raw_score: draft.raw_score.trim() === "" || draft.is_missing ? null : Number(draft.raw_score) } : {}),
  feedback: draft.feedback.trim() || null,
  is_missing: draft.is_missing,
  ratings: Object.keys(draft.ratings).length ? draft.ratings : null,
});

/** A score must be a number from 0 to the total, with at most two decimals. */
const scoreProblem = (value: string, total: number | null) => {
  if (value.trim() === "") return false;
  const n = Number(value);
  return !Number.isFinite(n) || n < 0 || (total !== null && n > total) || Math.round(n * 100) !== n * 100;
};

/**
 * Staff's review of a homework (HW-04, HW-05, HW-06): counts of who handed in, was late or is
 * missing; a reminder to those missing (and an SMS to their guardians); each student's work with a
 * score, feedback and ratings, or a return for redo; a grid to enter paper homework scores; and
 * publishing the scores to students.
 */
const HomeworkSubmissions = ({ homework }: { homework: HomeworkItem }) => {
  const t = useTranslations("homework.submissions");
  const tErrors = useTranslations("homework.errors");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: grid, failed, reload, setData: setGrid } = useApiData<HomeworkGrid>(`/homework/${homework.id}/grid`);
  const [open, setOpen] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [smsGuardians, setSmsGuardians] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (homework.status === "DRAFT" || homework.status === "SCHEDULED") return null;

  const isPaper = homework.submission_type === "PAPER";
  const scored = homework.total_marks !== null;
  const canAct = homework.can_edit && homework.status === "PUBLISHED";

  /** Calls the API; a refusal it knows is shown as a toast. Returns whether it worked. */
  const call = async <T,>(request: () => Promise<{ data: { payload: T } }>, done: (payload: T) => void): Promise<boolean> => {
    setBusy(true);
    try {
      done((await request()).data.payload);
      return true;
    } catch (error) {
      const data = (error as AxiosError<ApiError & { code?: string; details?: { total?: number } }>).response?.data;
      if (isScoreError(data?.code)) triggerToast({ title: t("notSaved"), description: tErrors(data.code, { max: data.details?.total ?? 0 }), type: "error" });
      else handleError(error as AxiosError<ApiError>);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveScores = (rows: HomeworkScoreInput[]) =>
    call(
      () => axiosReq.put<{ payload: HomeworkGrid }>(`${baseUrl}/homework/${homework.id}/scores`, { rows }),
      (next) => {
        setGrid(next);
        triggerToast({ title: t("saved"), description: t("savedDetail", { count: rows.length }), type: "success" });
      },
    );

  const returnForRedo = (submissionId: string, note: string) =>
    call(
      () => axiosReq.post<{ payload: HomeworkGrid }>(`${baseUrl}/homework/${homework.id}/submissions/${submissionId}/return`, { note: note.trim() || undefined }),
      (next) => {
        setGrid(next);
        triggerToast({ title: t("saved"), description: t("returned"), type: "success" });
      },
    );

  const remind = () =>
    call(
      () => axiosReq.post<{ payload: { students: number; guardian_sms: number } }>(`${baseUrl}/homework/${homework.id}/remind-missing`, { sms_guardians: smsGuardians }),
      (sent) => {
        setReminding(false);
        triggerToast({ title: t("saved"), description: t("reminded", { students: sent.students, sms: sent.guardian_sms }), type: "success" });
      },
    );

  const publish = () =>
    call(
      () => axiosReq.post<{ payload: HomeworkGrid }>(`${baseUrl}/homework/${homework.id}/publish-scores`, {}),
      (next) => {
        setGrid(next);
        setPublishing(false);
        triggerToast({ title: t("saved"), description: t("publishedDetail"), type: "success" });
      },
    );

  const openRow = grid?.rows.find((row) => row.student.id === open) ?? null;
  const missingNow = grid ? grid.rows.filter((row) => !row.latest).length : 0;

  return (
    <Card
      title={t("title")}
      description={grid ? t("summary", { handedIn: grid.counts.handed_in, total: grid.counts.students }) : undefined}
      actions={
        grid && canAct ? (
          <div className="flex flex-wrap gap-2">
            {!isPaper && missingNow > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => setReminding(true)}>
                {t("remind")}
              </Button>
            ) : null}
            {scored && !grid.homework.scores_published_at && grid.counts.scored > 0 ? (
              <Button size="sm" onClick={() => setPublishing(true)}>
                {t("publish")}
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : grid === null ? (
        <div aria-busy="true">
          <Skeleton lines={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile label={t("counts.students")} value={grid.counts.students} />
            <StatTile label={t("counts.handedIn")} value={grid.counts.handed_in} />
            <StatTile label={t("counts.late")} value={grid.counts.late} />
            <StatTile label={t("counts.missing")} value={grid.counts.missing} />
            <StatTile label={t("counts.scored")} value={grid.counts.scored} />
          </div>
          {scored ? (
            grid.homework.scores_published_at ? (
              <p className="text-body-sm text-ink-muted">{t("publishedOn", { when: format.dateTime(grid.homework.scores_published_at) })}</p>
            ) : (
              <p className="text-body-sm text-ink-muted">{t("notPublished")}</p>
            )
          ) : null}
          {isPaper ? (
            <PaperGrid key={JSON.stringify(grid.rows.map((row) => row.score))} grid={grid} scored={scored} canAct={canAct} busy={busy} onSave={saveScores} />
          ) : (
            <OnlineList grid={grid} scored={scored} onOpen={setOpen} />
          )}
        </div>
      )}
      {openRow?.latest ? (
        <ReviewDrawer
          key={`${openRow.student.id}-${openRow.latest.id}-${openRow.latest.status}`}
          homeworkId={homework.id}
          row={openRow}
          total={grid?.homework.total_marks ?? null}
          scored={scored}
          canAct={canAct}
          busy={busy}
          onSave={(rows) => saveScores(rows)}
          onReturn={returnForRedo}
          onClose={() => setOpen(null)}
        />
      ) : null}
      <Modal
        open={reminding}
        onClose={() => setReminding(false)}
        title={t("remindTitle")}
        description={t("remindDetail", { count: missingNow })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReminding(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={remind} loading={busy}>
              {t("remindSend")}
            </Button>
          </>
        }
      >
        <Checkbox label={t("smsGuardians")} hint={t("smsGuardiansHint")} checked={smsGuardians} onChange={(event) => setSmsGuardians(event.target.checked)} />
      </Modal>
      <ConfirmDialog
        open={publishing}
        title={t("publishTitle")}
        description={grid ? t("publishDetail", { scored: grid.counts.scored, total: grid.counts.students }) : undefined}
        confirmLabel={t("publish")}
        loading={busy}
        onConfirm={publish}
        onCancel={() => setPublishing(false)}
      />
    </Card>
  );
};

/** The student's state: handed in (late), returned for redo, scored, or not handed in. */
const StatePills = ({ row }: { row: HomeworkGridRow }) => {
  const t = useTranslations("homework.submissions");
  const tWork = useTranslations("homework.myWork");
  if (!row.latest) return <StatusPill tone={row.score?.is_missing ? "danger" : "neutral"}>{t("missing")}</StatusPill>;
  return (
    <span className="flex flex-wrap gap-1">
      <StatusPill tone={row.latest.status === "RETURNED" ? "warning" : "success"}>{tWork(`statuses.${row.latest.status}`)}</StatusPill>
      {row.latest.is_late ? <StatusPill tone="warning">{tWork("late", { minutes: row.latest.late_minutes ?? 0 })}</StatusPill> : null}
    </span>
  );
};

/** File and text homework: one row per student; "Open" shows their work and the score form. */
const OnlineList = ({ grid, scored, onOpen }: { grid: HomeworkGrid; scored: boolean; onOpen: (studentId: string) => void }) => {
  const t = useTranslations("homework.submissions");
  const format = useFormat();
  const columns: TableColumn<HomeworkGridRow>[] = [
    { key: "student", header: t("student"), cell: studentName },
    { key: "state", header: t("state"), cell: (row) => <StatePills row={row} /> },
    { key: "when", header: t("when"), cell: (row) => (row.latest ? format.dateTime(row.latest.submitted_at) : "—"), hideOnMobile: true },
    { key: "versions", header: t("versions"), align: "right", cell: (row) => format.number(row.versions), hideOnMobile: true },
    ...(scored
      ? [{ key: "score", header: t("score"), align: "right" as const, cell: (row: HomeworkGridRow) => (row.score ? scoreLabel(row.score, format.number) ?? "—" : "—") }]
      : []),
    {
      key: "open",
      header: t("actions"),
      align: "right",
      cell: (row) =>
        row.latest ? (
          <Button size="sm" variant="ghost" onClick={() => onOpen(row.student.id)} aria-label={t("openFor", { name: row.student.full_name })}>
            {t("open")}
          </Button>
        ) : null,
    },
  ];
  return <Table caption={t("title")} columns={columns} rows={grid.rows} getRowId={(row) => row.student.id} empty={<EmptyState title={t("empty")} />} />;
};

/** The 1–5 rating pickers (optional). */
const RatingFields = ({ value, onChange, disabled, name }: { value: HomeworkRatings; onChange: (next: HomeworkRatings) => void; disabled: boolean; name?: string }) => {
  const t = useTranslations("homework.submissions");
  const format = useFormat();
  const options = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: format.number(n) }));
  return (
    <div className="grid grid-cols-3 gap-2">
      {RATING_KEYS.map((key) => (
        <Select
          key={key}
          label={name ? t("ratingFor", { rating: t(`ratings.${key}`), name }) : t(`ratings.${key}`)}
          hideLabel={Boolean(name)}
          placeholder={name ? t(`ratings.${key}`) : "—"}
          options={options}
          value={value[key] ? String(value[key]) : ""}
          disabled={disabled}
          onChange={(event) => {
            const next = { ...value };
            if (event.target.value) next[key] = Number(event.target.value);
            else delete next[key];
            onChange(next);
          }}
        />
      ))}
    </div>
  );
};

/** One student's versions, with the score form and "Return for redo". */
const ReviewDrawer = ({
  homeworkId,
  row,
  total,
  scored,
  canAct,
  busy,
  onSave,
  onReturn,
  onClose,
}: {
  homeworkId: string;
  row: HomeworkGridRow;
  total: number | null;
  scored: boolean;
  canAct: boolean;
  busy: boolean;
  onSave: (rows: HomeworkScoreInput[]) => Promise<boolean>;
  onReturn: (submissionId: string, note: string) => Promise<boolean>;
  onClose: () => void;
}) => {
  const t = useTranslations("homework.submissions");
  const tWork = useTranslations("homework.myWork");
  const format = useFormat();
  const { data } = useApiData<SubmissionDetail>(`/homework/${homeworkId}/submissions/${row.latest?.id}`);
  const [draft, setDraft] = useState<ScoreDraft>(draftOf(row));
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const invalid = scored && scoreProblem(draft.raw_score, total);

  return (
    <Drawer open onClose={onClose} title={row.student.full_name} wide>
      <div className="flex flex-col gap-4">
        {!data ? (
          <Skeleton lines={5} />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.versions.map((submission) => (
              <li key={submission.id} className="flex flex-col gap-2 rounded-input border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{tWork("version", { version: submission.version })}</span>
                  <span className="text-body-sm text-ink-muted">{format.dateTime(submission.submitted_at)}</span>
                  <StatusPill tone={submission.status === "RETURNED" ? "warning" : "neutral"}>{tWork(`statuses.${submission.status}`)}</StatusPill>
                  {submission.is_late ? <StatusPill tone="warning">{tWork("late", { minutes: submission.late_minutes ?? 0 })}</StatusPill> : null}
                </div>
                {submission.text_answer ? <p className="whitespace-pre-wrap text-body text-ink">{submission.text_answer}</p> : null}
                {submission.files.map((file) => (
                  <a key={file.id} href={`${baseUrl}/files/${file.id}/content`} target="_blank" rel="noreferrer" className="text-primary underline">
                    {file.name ?? tWork("file")}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        )}
        {row.score && row.score.penalty > 0 ? (
          <p className="text-body-sm text-ink-muted">{t("penaltyTaken", { penalty: row.score.penalty })}</p>
        ) : null}
        {canAct ? (
          <form
            className="flex flex-col gap-3 border-t border-border pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!invalid) void onSave([inputOf(row.student.id, draft, scored)]);
            }}
          >
            {scored ? (
              <Input
                label={t("score")}
                inputMode="decimal"
                value={draft.raw_score}
                onChange={(event) => setDraft({ ...draft, raw_score: event.target.value })}
                trailing={total !== null ? `/ ${format.number(total)}` : undefined}
                hint={row.latest?.is_late ? t("lateHint") : undefined}
                error={invalid ? t("scoreInvalid", { max: total ?? 0 }) : undefined}
              />
            ) : null}
            <Textarea label={t("feedback")} value={draft.feedback} rows={3} maxLength={2000} onChange={(event) => setDraft({ ...draft, feedback: event.target.value })} />
            <RatingFields value={draft.ratings} onChange={(ratings) => setDraft({ ...draft, ratings })} disabled={busy} />
            <div className="flex flex-wrap justify-between gap-2">
              {row.latest && row.latest.status !== "RETURNED" ? (
                <Button type="button" variant="secondary" onClick={() => setReturning(true)} disabled={busy}>
                  {t("return")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" loading={busy} disabled={invalid}>
                {t("saveScore")}
              </Button>
            </div>
          </form>
        ) : row.score ? (
          <p className="text-body text-ink">{scoreLabel(row.score, format.number)}</p>
        ) : null}
      </div>
      <Modal
        open={returning}
        onClose={() => setReturning(false)}
        title={t("returnTitle")}
        description={t("returnDetail")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturning(false)}>
              {t("cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (row.latest && (await onReturn(row.latest.id, note))) setReturning(false);
              }}
            >
              {t("return")}
            </Button>
          </>
        }
      >
        <Textarea label={t("returnNote")} value={note} rows={3} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </Modal>
    </Drawer>
  );
};

/** Paper homework: a grid to type every student's score, remark and ratings, saved together. */
const PaperGrid = ({
  grid,
  scored,
  canAct,
  busy,
  onSave,
}: {
  grid: HomeworkGrid;
  scored: boolean;
  canAct: boolean;
  busy: boolean;
  onSave: (rows: HomeworkScoreInput[]) => Promise<boolean>;
}) => {
  const t = useTranslations("homework.submissions");
  const format = useFormat();
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>(() => Object.fromEntries(grid.rows.map((row) => [row.student.id, draftOf(row)])));
  const total = grid.homework.total_marks;
  const change = (id: string, patch: Partial<ScoreDraft>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const changed = grid.rows.filter((row) => JSON.stringify(drafts[row.student.id]) !== JSON.stringify(draftOf(row)));
  const invalid = scored && grid.rows.some((row) => scoreProblem(drafts[row.student.id].raw_score, total));

  if (!canAct) {
    const columns: TableColumn<HomeworkGridRow>[] = [
      { key: "student", header: t("student"), cell: studentName },
      { key: "state", header: t("state"), cell: (row) => (row.score?.is_missing ? <StatePills row={row} /> : "—") },
      ...(scored ? [{ key: "score", header: t("score"), align: "right" as const, cell: (row: HomeworkGridRow) => (row.score ? scoreLabel(row.score, format.number) ?? "—" : "—") }] : []),
      { key: "feedback", header: t("remark"), cell: (row) => row.score?.feedback ?? "—", hideOnMobile: true },
    ];
    return <Table caption={t("title")} columns={columns} rows={grid.rows} getRowId={(row) => row.student.id} empty={<EmptyState title={t("empty")} />} />;
  }

  if (grid.rows.length === 0) return <EmptyState title={t("empty")} />;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid && changed.length) void onSave(changed.map((row) => inputOf(row.student.id, drafts[row.student.id], scored)));
      }}
    >
      <p className="text-body-sm text-ink-muted">{t("paperHint")}</p>
      <ul className="flex flex-col divide-y divide-border">
        {grid.rows.map((row) => {
          const draft = drafts[row.student.id];
          const name = row.student.full_name;
          return (
            <li key={row.student.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-start">
              <span className="font-medium text-ink lg:w-48 lg:pt-2">{studentName(row)}</span>
              {scored ? (
                <Input
                  label={t("scoreFor", { name })}
                  hideLabel
                  placeholder={t("score")}
                  inputMode="decimal"
                  fieldClassName="lg:w-32"
                  value={draft.is_missing ? "" : draft.raw_score}
                  disabled={draft.is_missing}
                  onChange={(event) => change(row.student.id, { raw_score: event.target.value })}
                  trailing={total !== null ? `/ ${format.number(total)}` : undefined}
                  error={scoreProblem(draft.raw_score, total) ? t("scoreInvalid", { max: total ?? 0 }) : undefined}
                />
              ) : null}
              <Input
                label={t("remarkFor", { name })}
                hideLabel
                placeholder={t("remark")}
                maxLength={2000}
                fieldClassName="lg:flex-1"
                value={draft.feedback}
                onChange={(event) => change(row.student.id, { feedback: event.target.value })}
              />
              <div className="lg:w-72">
                <RatingFields name={name} value={draft.ratings} onChange={(ratings) => change(row.student.id, { ratings })} disabled={busy} />
              </div>
              <div className="lg:pt-2">
                <Checkbox label={t("notHandedIn")} checked={draft.is_missing} onChange={(event) => change(row.student.id, { is_missing: event.target.checked })} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end gap-3">
        {changed.length ? <span className="text-body-sm text-ink-muted">{t("unsaved", { count: changed.length })}</span> : null}
        <Button type="submit" loading={busy} disabled={invalid || changed.length === 0}>
          {t("saveAll")}
        </Button>
      </div>
    </form>
  );
};

export default HomeworkSubmissions;
