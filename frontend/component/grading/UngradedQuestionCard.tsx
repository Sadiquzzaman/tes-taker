import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import QuestionFilledIconSVG from "../svg/QuestionFilledIconSVG";
import { resizeTextarea } from "@/utils/grading/resizeTextarea";
import { useEffect, useRef, useState } from "react";

const formatScoreLabel = (value: number) => {
  return String(value);
};

const UngradedQuestionCard = ({
  draft,
  isReadOnly,
  onExplanationChange,
  onScoreBlur,
  onScoreChange,
  question,
}: GradingModalUngradedQuestionCardProps) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const displayedScore = draft?.score ?? formatScoreLabel(question.marksObtained);
  const showEditableControls = !isReadOnly && question.isEditable;
  const parsedScore = Number(displayedScore);
  const hasPositiveScore = !Number.isNaN(parsedScore) && parsedScore > 0;
  const showSuccessIcon = !isInteracting && hasPositiveScore;
  const cardStateClassName = isInteracting ? "border-transparent bg-[#ED86001A]" : "border-[#E5E5E5] bg-white";

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
                value={displayedScore}
                onChange={(event) => onScoreChange?.(question.id, event.target.value)}
                onBlur={() => onScoreBlur?.(question.id, question.points, question.marksObtained)}
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

        {showEditableControls ? (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-[500] leading-[20px] text-[#232A25]">Explanation</p>
            <textarea
              rows={1}
              value={draft?.explanation ?? ""}
              onChange={(event) => {
                resizeTextarea(event.target);
                onExplanationChange?.(question.id, event.target.value);
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
