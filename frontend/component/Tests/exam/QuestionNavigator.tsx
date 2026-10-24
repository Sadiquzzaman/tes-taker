"use client";

import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";
import { cn, focusRing } from "@/design/ui";

export interface NavigatorQuestion {
  id: string;
  number: number;
}

/** True when a question has an answer (text typed, an option chosen, or a recording made). */
export const isAnswered = (value: ExamAnswerValue | undefined) =>
  Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim() !== "" : false;

/** Every question number, coloured by state; tap one to jump to it (design-system §3.4 "calm exam screen"). */
const QuestionNavigator = ({
  questions,
  answerState,
  flagged,
  onJump,
  className,
}: {
  questions: NavigatorQuestion[];
  answerState: ExamAnswerState;
  flagged: Set<string>;
  onJump: (id: string) => void;
  className?: string;
}) => {
  const t = useTranslations("exam.navigator");
  const format = useFormat();
  const answered = questions.filter((question) => isAnswered(answerState[question.id])).length;

  return (
    <nav aria-label={t("title")} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm font-semibold text-ink">{t("title")}</p>
        <p className="text-caption text-ink-muted">{t("progress", { answered, total: questions.length })}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
      </div>
      <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 xl:grid-cols-5">
        {questions.map((question) => {
          const done = isAnswered(answerState[question.id]);
          const isFlagged = flagged.has(question.id);
          const state = done && isFlagged ? "answeredFlagged" : done ? "answered" : isFlagged ? "flagged" : "open";
          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onJump(question.id)}
                aria-label={t("go", { number: question.number, state })}
                className={cn(
                  "relative flex h-9 w-full items-center justify-center rounded-input text-body-sm font-medium",
                  done ? "bg-primary text-ink-inverse" : "border border-border bg-surface text-ink hover:border-primary",
                  isFlagged && "ring-2 ring-warning ring-offset-1",
                  focusRing,
                )}
              >
                {format.number(question.number)}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary" />
          {t("legendAnswered")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-border" />
          {t("legendOpen")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-2 ring-warning" />
          {t("legendFlagged")}
        </li>
      </ul>
    </nav>
  );
};

export default QuestionNavigator;
