import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import QuestionFilledIconSVG from "../svg/QuestionFilledIconSVG";
import getSubmissionGradeValidationError from "@/utils/grading/getSubmissionGradeValidationError";
import {
  selectSubmissionGradingEntry,
  setSubmissionGradeExplanation,
  setSubmissionGradeScore,
} from "@/lib/features/gradingSubmissionSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { resizeTextarea } from "@/utils/grading/resizeTextarea";
import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextContent } from "@/component/RichTextEditor";
import Image from "next/image";
import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";

const formatScoreLabel = (value: number) => {
  return String(value);
};

const isDecimalInput = (value: string) => {
  return value === "" || /^-?\d*(\.\d*)?$/.test(value);
};

const UngradedQuestionCard = ({ isReadOnly, question }: GradingModalUngradedQuestionCardProps) => {
  const t = useTranslations("grading.answer");
  const format = useFormat();
  const dispatch = useAppDispatch();
  const { exam, selectedSubmission } = useAppSelector((state) => state.gradeDetails);
  const examId = exam?.id ?? null;
  const submissionId = selectedSubmission?.submission_id ?? null;
  const cachedEntry = useAppSelector((state) => selectSubmissionGradingEntry(state, examId, submissionId));
  const grade = useMemo(() => {
    return cachedEntry?.graded.find((item) => item.question_id === question.id);
  }, [cachedEntry?.graded, question.id]);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const showEditableControls = !isReadOnly && question.isEditable;
  const persistedScore = useMemo(() => {
    return grade?.marks_obtained ?? question.marksObtained;
  }, [grade?.marks_obtained, question.marksObtained]);
  const [scoreInput, setScoreInput] = useState(formatScoreLabel(persistedScore));
  // Show the saved score again whenever it changes or another question is shown.
  const [scoreSource, setScoreSource] = useState({ questionId: question.id, score: persistedScore });
  if (scoreSource.questionId !== question.id || scoreSource.score !== persistedScore) {
    setScoreSource({ questionId: question.id, score: persistedScore });
    setScoreInput(formatScoreLabel(persistedScore));
  }
  // A read-only card is never in the interacting state.
  if (!showEditableControls && isInteracting) {
    setIsInteracting(false);
  }
  const parsedScore = Number(scoreInput);
  const hasPositiveScore = !Number.isNaN(parsedScore) && parsedScore > 0;
  const showSuccessIcon = !isInteracting && hasPositiveScore;
  const cardStateClassName = isInteracting ? "border-transparent bg-warning-soft" : "border-border bg-surface";
  const validationError = grade ? getSubmissionGradeValidationError(grade.marks_obtained, question.points) : "";

  useEffect(() => {
    if (!showEditableControls) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const eventTarget = event.target;

      if (!(eventTarget instanceof Node)) {
        return;
      }

      const isInsideCard = Boolean(cardRef.current?.contains(eventTarget));
      setIsInteracting(isInsideCard);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showEditableControls]);

  return (
    <div
      ref={cardRef}
      className={`flex flex-col gap-6 rounded-input border p-5 transition-colors duration-150 ${cardStateClassName}`}
      onClick={() => {
        if (showEditableControls) {
          setIsInteracting(true);
        }
      }}
      onFocusCapture={() => {
        if (showEditableControls) {
          setIsInteracting(true);
        }
      }}
      onBlurCapture={() => {
        if (!showEditableControls) {
          return;
        }

        window.requestAnimationFrame(() => {
          const activeElement = document.activeElement;
          const isFocusInsideCard = activeElement instanceof Node && Boolean(cardRef.current?.contains(activeElement));
          setIsInteracting(isFocusInsideCard);
        });
      }}
    >
      <div className="flex flex-col gap-3">
        {question.instruction ? (
          <RichTextContent
            html={question.instruction}
            className="text-body-sm font-normal text-ink-muted"
          />
        ) : null}
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-body font-medium text-ink">{format.number(question.questionNumber)}.</span>
          <RichTextContent
            html={question.question}
            className="flex-1 text-body font-medium text-ink"
          />
          {isInteracting ? <QuestionFilledIconSVG width={20} /> : null}
          {!isInteracting && showSuccessIcon ? <CorrectFilledIconSVG width={20} /> : null}
        </div>
      </div>

      {question.imageUrl ? (
        <Image
          src={question.imageUrl}
          alt={t("imageAlt", { number: question.questionNumber })}
          width={0}
          height={0}
          sizes="100vw"
          unoptimized
          className="h-auto max-h-60 w-auto rounded-input object-contain"
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <p className="text-body-sm font-semibold uppercase tracking-wide text-primary">{t("studentAnswer")}</p>
        {question.mediaUrl ||
        (question.textAnswer &&
          (question.textAnswer.startsWith("data:audio") ||
            question.textAnswer.startsWith("http") ||
            question.textAnswer.startsWith("/uploads/"))) ? (
          <audio
            controls
            src={question.mediaUrl || question.textAnswer}
            className="w-full"
            preload="metadata"
          />
        ) : (
          <p className="whitespace-pre-wrap text-body text-ink">{question.textAnswer || <span className="text-ink-muted">{t("none")}</span>}</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor={`score-${question.id}`} className="text-body-sm font-medium text-ink">{t("score")}</label>
            {showEditableControls ? (
              <input
                id={`score-${question.id}`}
                type="text"
                inputMode="decimal"
                aria-invalid={validationError ? true : undefined}
                value={scoreInput}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (!isDecimalInput(nextValue)) {
                    return;
                  }

                  setScoreInput(nextValue);

                  if (
                    !examId ||
                    !submissionId ||
                    nextValue === "" ||
                    nextValue === "-" ||
                    nextValue === "." ||
                    nextValue === "-."
                  ) {
                    return;
                  }

                  const parsedNextValue = Number(nextValue);

                  if (Number.isNaN(parsedNextValue)) {
                    return;
                  }

                  dispatch(
                    setSubmissionGradeScore({
                      examId,
                      submissionId,
                      questionId: question.id,
                      marksObtained: parsedNextValue,
                    }),
                  );
                }}
                onBlur={() => {
                  const fallbackScore = grade?.marks_obtained ?? 0;

                  if (!examId || !submissionId || scoreInput === "") {
                    setScoreInput(formatScoreLabel(fallbackScore));
                    return;
                  }

                  const parsedCurrentScore = Number(scoreInput);

                  if (Number.isNaN(parsedCurrentScore)) {
                    setScoreInput(formatScoreLabel(fallbackScore));
                    return;
                  }

                  const normalizedScore = Math.min(Math.max(parsedCurrentScore, 0), question.points);

                  dispatch(
                    setSubmissionGradeScore({
                      examId,
                      submissionId,
                      questionId: question.id,
                      marksObtained: normalizedScore,
                    }),
                  );

                  setScoreInput(formatScoreLabel(normalizedScore));
                }}
                className="h-9 w-20 rounded-input border border-border bg-surface px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            ) : (
              <div className="flex h-8 min-w-16 items-center justify-center rounded-sm border border-border bg-surface px-5">
                <p className="text-body-sm text-ink">{format.number(question.marksObtained)}</p>
              </div>
            )}
          </div>
          <p className="text-body-sm text-ink-muted">{t("maxMarks", { points: question.points })}</p>
        </div>

        {validationError ? <p role="alert" className="text-caption text-danger">{t(validationError)}</p> : null}

        {showEditableControls ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`feedback-${question.id}`} className="text-body-sm font-medium text-ink">{t("explanation")}</label>
            <textarea
              id={`feedback-${question.id}`}
              rows={1}
              value={grade?.explanation ?? ""}
              onChange={(event) => {
                resizeTextarea(event.target);

                if (!examId || !submissionId) {
                  return;
                }

                dispatch(
                  setSubmissionGradeExplanation({
                    examId,
                    submissionId,
                    questionId: question.id,
                    explanation: event.target.value,
                  }),
                );
              }}
              placeholder={t("explanationPlaceholder")}
              className="min-h-10 w-full resize-none rounded-input border border-border px-3 py-2 text-body-sm text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary"
              ref={resizeTextarea}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default UngradedQuestionCard;
