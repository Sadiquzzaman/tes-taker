import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import QuestionFilledIconSVG from "../svg/QuestionFilledIconSVG";
import getSubmissionGradeValidationError from "@/utils/grading/getSubmissionGradeValidationError";
import { selectSubmissionGradingEntry, setSubmissionGradeExplanation, setSubmissionGradeScore } from "@/lib/features/gradingSubmissionSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { resizeTextarea } from "@/utils/grading/resizeTextarea";
import { useEffect, useMemo, useRef, useState } from "react";

const formatScoreLabel = (value: number) => {
  return String(value);
};

const isDecimalInput = (value: string) => {
  return value === "" || /^-?\d*(\.\d*)?$/.test(value);
};

const UngradedQuestionCard = ({ isReadOnly, question }: GradingModalUngradedQuestionCardProps) => {
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
  const parsedScore = Number(scoreInput);
  const hasPositiveScore = !Number.isNaN(parsedScore) && parsedScore > 0;
  const showSuccessIcon = !isInteracting && hasPositiveScore;
  const cardStateClassName = isInteracting ? "border-transparent bg-[#ED86001A]" : "border-[#E5E5E5] bg-white";
  const validationError = grade ? getSubmissionGradeValidationError(grade.marks_obtained, question.points) : "";

  useEffect(() => {
    setScoreInput(formatScoreLabel(persistedScore));
  }, [persistedScore, question.id]);

  useEffect(() => {
    if (!showEditableControls) {
      setIsInteracting(false);
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
      className={`flex flex-col gap-6 rounded-[8px] border p-5 transition-colors duration-150 ${cardStateClassName}`}
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
          <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">{question.instruction}</p>
        ) : null}
        <div className="flex items-start gap-2">
          <span className="w-4 shrink-0 text-center text-[16px] font-[500] leading-[1.25] tracking-[-0.02em] text-[#0F1A12]">
            {question.questionNumber}.
          </span>
          <p className="flex-1 text-[16px] font-[500] leading-[1.25] tracking-[-0.02em] text-[#0F1A12]">{question.question}</p>
          {isInteracting ? <QuestionFilledIconSVG width={20} /> : null}
          {!isInteracting && showSuccessIcon ? <CorrectFilledIconSVG width={20} /> : null}
        </div>
      </div>

      {question.imageUrl ? <img src={question.imageUrl} alt="Question" className="max-h-[240px] rounded-[8px] object-contain" /> : null}

      <div className="flex flex-col gap-3">
        <p className="text-[16px] font-[600] uppercase leading-[1.25] tracking-[-0.02em] text-[#49734F]">Student Answer</p>
        <p className="text-[16px] font-[400] leading-[1.2] tracking-[-0.02em] text-[#747775]">{question.textAnswer || "No answer submitted"}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-[400] leading-[1.25] tracking-[-0.02em] text-[#232A25]">Score</p>
            {showEditableControls ? (
              <input
                type="text"
                inputMode="decimal"
                value={scoreInput}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (!isDecimalInput(nextValue)) {
                    return;
                  }

                  setScoreInput(nextValue);

                  if (!examId || !submissionId || nextValue === "" || nextValue === "-" || nextValue === "." || nextValue === "-.") {
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
                className="h-8 w-16 rounded-[2px] border border-[#E5E5E5] bg-white px-2 text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25] focus:outline-none"
              />
            ) : (
              <div className="flex h-8 min-w-16 items-center justify-center rounded-[2px] border border-[#E5E5E5] bg-white px-5">
                <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">{formatScoreLabel(question.marksObtained)}</p>
              </div>
            )}
          </div>
          <p className="text-[14px] font-[400] leading-[1.25] tracking-[-0.02em] text-[#747775]">
            Max marks: <span className="font-[500] text-[#232A25]">{question.points}</span>
          </p>
        </div>

        {validationError ? <p className="text-[12px] font-[400] leading-4 text-[#D24B44]">{validationError}</p> : null}

        {showEditableControls ? (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-[500] leading-[20px] text-[#232A25]">Explanation</p>
            <textarea
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
              placeholder="Write explanation"
              className="min-h-10 w-full resize-none rounded-[8px] border border-[#E5E5E5] px-2 py-[10px] text-[14px] font-[400] leading-5 text-[#232A25] placeholder:text-[#747775] focus:outline-none"
              ref={resizeTextarea}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default UngradedQuestionCard;
