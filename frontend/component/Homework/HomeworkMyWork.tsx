"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, Checkbox, FileDrop, type FileDropItem, Skeleton, StatusPill, Textarea } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { isPhoto, photosToPdf } from "@/utils/homework/photosToPdf";
import { uploadMedia } from "@/utils/media/uploadMedia";
import { RATING_KEYS, scoreLabel } from "./homeworkFormat";
import useApiData from "./useApiData";

/** Hand-in refusals the card explains itself (messages `homework.errors`). */
const SUBMIT_ERRORS = [
  "HOMEWORK_PAPER_NO_SUBMISSION",
  "HOMEWORK_LATE_NOT_ALLOWED",
  "HOMEWORK_NO_MORE_SUBMISSIONS",
  "HOMEWORK_ALREADY_SCORED",
  "HOMEWORK_SUBMISSION_EMPTY",
  "HOMEWORK_TOO_MANY_FILES",
  "HOMEWORK_FILE_INVALID",
  "HOMEWORK_SESSION_CLOSED",
] as const;
type SubmitError = (typeof SUBMIT_ERRORS)[number] | "UPLOAD_FAILED";
const isSubmitError = (code: unknown): code is SubmitError => (SUBMIT_ERRORS as readonly unknown[]).includes(code);

/**
 * The student's side of a homework (HW-03): hand it in (files, with several photos combined into one
 * PDF, or a typed answer), see every version handed in with its late tag, and why they may not hand
 * in again. Paper homework is handed to the teacher instead.
 */
const HomeworkMyWork = ({ homework }: { homework: HomeworkItem }) => {
  const t = useTranslations("homework.myWork");
  const tErrors = useTranslations("homework.errors");
  const format = useFormat();
  const { handleError } = useApiError();
  const { data: mine, setData } = useApiData<MySubmissions>(`/homework/${homework.id}/my-submissions`);
  const [files, setFiles] = useState<File[]>([]);
  const [combine, setCombine] = useState(true);
  const [answer, setAnswer] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<SubmitError | null>(null);
  const [sending, setSending] = useState(false);

  if (homework.submission_type === "PAPER") {
    return (
      <Card title={t("title")}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink">{t("paper")}</p>
          {mine?.score ? <MyScore score={mine.score} /> : null}
        </div>
      </Card>
    );
  }
  if (!mine) {
    return (
      <Card title={t("title")} aria-busy="true">
        <Skeleton lines={3} />
      </Card>
    );
  }

  const photos = files.filter(isPhoto);
  const willCombine = combine && photos.length > 1;
  const items: FileDropItem[] = files.map((file, index) => ({ id: `${index}-${file.name}`, name: file.name, progress: progress ?? undefined }));

  const submit = async () => {
    if (homework.submission_type === "FILE" && files.length === 0) return setError("HOMEWORK_SUBMISSION_EMPTY");
    if (homework.submission_type === "TEXT" && !answer.trim()) return setError("HOMEWORK_SUBMISSION_EMPTY");
    setError(null);
    setSending(true);
    try {
      // Several photos become one PDF; other files go as they are.
      const toUpload = willCombine ? [await photosToPdf(photos, `${homework.title.slice(0, 40) || "homework"}.pdf`), ...files.filter((f) => !isPhoto(f))] : files;
      const ids: string[] = [];
      for (const [index, file] of toUpload.entries()) {
        try {
          const uploaded = await uploadMedia("homework", file, undefined, {
            onProgress: (value) => setProgress(Math.round(((index + value / 100) / toUpload.length) * 100)),
          });
          ids.push(uploaded.id);
        } catch {
          setError("UPLOAD_FAILED");
          return;
        }
      }
      const res = await axiosReq.post<{ payload: MySubmissions }>(`${process.env.NEXT_PUBLIC_BASE_URL}/homework/${homework.id}/submissions`, {
        file_ids: ids,
        ...(answer.trim() ? { text_answer: answer.trim() } : {}),
      });
      setData(res.data.payload);
      setFiles([]);
      setAnswer("");
    } catch (err) {
      const code = (err as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (isSubmitError(code)) setError(code);
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <Card title={t("title")}>
      <div className="flex flex-col gap-5">
        {mine.score ? <MyScore score={mine.score} /> : null}
        {mine.can_submit ? (
          <div className="flex flex-col gap-4">
            {mine.late_now ? (
              <p role="status" className="rounded-input bg-warning-soft px-3 py-2 text-body-sm text-ink">
                {t("lateWarning")}
              </p>
            ) : null}
            {homework.submission_type === "TEXT" ? (
              <Textarea label={t("answer")} rows={8} maxLength={20_000} value={answer} onChange={(event) => setAnswer(event.target.value)} />
            ) : null}
            <FileDrop
              label={homework.submission_type === "TEXT" ? t("filesOptional") : t("files")}
              onFiles={(added) => setFiles((current) => [...current, ...added])}
              items={items}
              onRemove={(id) => setFiles((current) => current.filter((file, index) => `${index}-${file.name}` !== id))}
              accept="image/*,.pdf,.doc,.docx,.txt"
              acceptLabel={t("filesAccept", { count: mine.max_files })}
              maxSizeMb={20}
              multiple
            />
            {photos.length > 1 ? <Checkbox label={t("combine")} hint={t("combineHint")} checked={combine} onChange={(event) => setCombine(event.target.checked)} /> : null}
            {error ? (
              <p role="alert" className="text-body-sm text-danger">
                {tErrors(error, { max: mine.max_files })}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button loading={sending} disabled={sending} onClick={() => void submit()}>
                {mine.submissions.length ? t("submitAgain") : t("submit")}
              </Button>
              <span className="text-body-sm text-ink-muted">{t(mine.submissions.length ? "left" : "leftFirst", { count: mine.submissions_left })}</span>
            </div>
          </div>
        ) : mine.blocked_by && isSubmitError(mine.blocked_by) ? (
          <p className="text-body text-ink">{tErrors(mine.blocked_by, { max: mine.max_files })}</p>
        ) : null}

        {mine.submissions.length ? (
          <section className="flex flex-col gap-3" aria-label={t("handedIn")}>
            <h3 className="text-title-sm font-semibold text-ink">{t("handedIn")}</h3>
            <ul className="flex flex-col gap-3">
              {mine.submissions.map((submission) => (
                <li key={submission.id} className="flex flex-col gap-2 rounded-input border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{t("version", { version: submission.version })}</span>
                    <span className="text-body-sm text-ink-muted">{format.dateTime(submission.submitted_at)}</span>
                    {submission.is_late ? <StatusPill tone="warning">{t("late", { minutes: submission.late_minutes ?? 0 })}</StatusPill> : null}
                    <StatusPill tone={submission.status === "SCORED" ? "success" : submission.status === "RETURNED" ? "warning" : "neutral"}>
                      {t(`statuses.${submission.status}`)}
                    </StatusPill>
                  </div>
                  {submission.text_answer ? <p className="whitespace-pre-wrap text-body text-ink">{submission.text_answer}</p> : null}
                  {submission.files.length ? (
                    <ul className="flex flex-col gap-1">
                      {submission.files.map((file) => (
                        <li key={file.id}>
                          <a href={`${process.env.NEXT_PUBLIC_BASE_URL}/files/${file.id}/content`} target="_blank" rel="noreferrer" className="text-primary underline">
                            {file.name ?? t("file")}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Card>
  );
};

/** The student's published score (HW-04): "8/10 · 80% (A+)", the late penalty, feedback and ratings. */
const MyScore = ({ score }: { score: HomeworkScore }) => {
  const t = useTranslations("homework.myWork");
  const tReview = useTranslations("homework.submissions");
  const format = useFormat();
  const label = scoreLabel(score, format.number);
  const ratings = RATING_KEYS.filter((key) => score.ratings?.[key]);
  return (
    <section className="flex flex-col gap-2 rounded-input border border-border bg-canvas p-3" aria-label={t("score")}>
      <h3 className="text-title-sm font-semibold text-ink">{t("score")}</h3>
      {score.is_missing ? <StatusPill tone="danger">{t("notHandedIn")}</StatusPill> : null}
      {label ? <p className="text-title font-semibold text-ink">{label}</p> : null}
      {score.penalty > 0 && score.raw_score !== null ? (
        <p className="text-body-sm text-ink-muted">{t("penalty", { raw: score.raw_score, penalty: score.penalty })}</p>
      ) : null}
      {score.feedback ? <p className="whitespace-pre-wrap text-body text-ink">{score.feedback}</p> : null}
      {ratings.length ? (
        <p className="flex flex-wrap gap-2">
          {ratings.map((key) => (
            <StatusPill key={key} tone="neutral">
              {t("rating", { rating: tReview(`ratings.${key}`), value: score.ratings?.[key] ?? 0 })}
            </StatusPill>
          ))}
        </p>
      ) : null}
    </section>
  );
};

export default HomeworkMyWork;
