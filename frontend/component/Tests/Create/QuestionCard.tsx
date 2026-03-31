import CopyIconSVG from "@/component/svg/CopyIconSVG";
import DragHandleIcon from "@/component/svg/DragHandleIcon";
import ShuffleIcon from "@/component/svg/ShuffleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import {
  addOption,
  clearPendingFocusOption,
  clearPendingFocusQuestionId,
  deleteQuestion,
  duplicateQuestion,
  removeOption,
  selectCorrectOption,
  setActiveQuestionId,
  shuffleOptions,
  updateOptionText,
  updateQuestionPoints,
  updateQuestionText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo, useCallback, useEffect, useRef } from "react";

const resizeTextarea = (element: HTMLTextAreaElement | null) => {
  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

const QuestionCard = memo(
  ({
    scrollContainerRef,
    sectionId,
    sectionType,
    setCardRef,
    question,
    questionNumber,
    isActive,
    shouldAutoFocus,
    pendingFocusOptionId,
    isDragging,
    isDragOverlay = false,
    overlayStyle,
    onDragHandlePointerDown,
  }: QuestionCardProps) => {
    const dispatch = useAppDispatch();
    const cardRef = useRef<HTMLDivElement>(null);
    const optionInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    const addOptionButtonRef = useRef<HTMLButtonElement>(null);
    const questionInputRef = useRef<HTMLTextAreaElement>(null);

    const scrollElementIntoView = useCallback(
      (element: HTMLElement | null, behavior: ScrollBehavior = "smooth") => {
        const scrollContainer = scrollContainerRef.current;

        if (!scrollContainer || !element) {
          return;
        }

        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const topPadding = 16;
        const bottomPadding = 50;

        if (elementRect.top < containerRect.top + topPadding) {
          scrollContainer.scrollBy({
            top: elementRect.top - containerRect.top - topPadding,
            behavior,
          });
          return;
        }

        if (elementRect.bottom > containerRect.bottom - bottomPadding) {
          scrollContainer.scrollBy({
            top: elementRect.bottom - containerRect.bottom + bottomPadding,
            behavior,
          });
        }
      },
      [scrollContainerRef],
    );

    const handleAddOptionWithScroll = useCallback(() => {
      dispatch(addOption({ sectionId, questionId: question.id }));

      if (addOptionButtonRef.current && scrollContainerRef.current) {
        const buttonRect = addOptionButtonRef.current.getBoundingClientRect();
        const scrollRect = scrollContainerRef.current.getBoundingClientRect();
        const distanceFromBottom = scrollRect.bottom - buttonRect.bottom;

        if (distanceFromBottom <= 30) {
          setTimeout(() => {
            scrollContainerRef.current?.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }, 0);
        }
      }
    }, [dispatch, question.id, scrollContainerRef, sectionId]);

    useEffect(() => {
      if (!pendingFocusOptionId) {
        return;
      }

      const input = optionInputRefs.current[pendingFocusOptionId];

      if (input) {
        input.focus();
        requestAnimationFrame(() => {
          scrollElementIntoView(input);
        });
        dispatch(clearPendingFocusOption());
      }
    }, [dispatch, pendingFocusOptionId, question.options, scrollElementIntoView]);

    useEffect(() => {
      if (shouldAutoFocus && questionInputRef.current) {
        questionInputRef.current.focus();
        resizeTextarea(questionInputRef.current);
        requestAnimationFrame(() => {
          scrollElementIntoView(cardRef.current);
        });
        dispatch(clearPendingFocusQuestionId());
      }
    }, [dispatch, scrollElementIntoView, shouldAutoFocus]);

    useEffect(() => {
      resizeTextarea(questionInputRef.current);
    }, [question.text]);

    useEffect(() => {
      Object.values(optionInputRefs.current).forEach((element) => {
        resizeTextarea(element);
      });
    }, [question.options]);

    return (
      <div
        ref={(node) => {
          cardRef.current = node;
          setCardRef(node);
        }}
        style={overlayStyle}
        className={`w-full rounded-[8px] border p-5 transition-[opacity,transform,box-shadow] duration-200 ${
          isActive ? "border-transparent bg-[#FDF3E5]" : "border-[#E5E5E5] bg-white"
        } ${isDragging ? "opacity-0" : "opacity-100"} ${
          isDragOverlay ? "fixed z-50 pointer-events-none shadow-[0px_24px_60px_rgba(15,26,18,0.18)]" : ""
        }`}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-8">
            <div className="flex items-start gap-2 w-full">
              <span className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
                {questionNumber}.
              </span>
              <textarea
                ref={questionInputRef}
                value={question.text}
                onChange={(e) =>
                  dispatch(
                    updateQuestionText({
                      sectionId,
                      questionId: question.id,
                      text: e.target.value,
                    }),
                  )
                }
                onFocus={(event) => {
                  resizeTextarea(event.currentTarget);
                  dispatch(setActiveQuestionId(question.id));
                }}
                placeholder="Write your question here.."
                rows={1}
                className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12] outline-none placeholder:text-[#747775]"
              />
            </div>
            <button
              type="button"
              onPointerDown={(event) => onDragHandlePointerDown(sectionId, question.id, event)}
              className="flex-shrink-0 cursor-grab touch-none text-[#747775] transition-colors hover:text-[#232A25] active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <DragHandleIcon />
            </button>
          </div>

          {sectionType === "objective" && (
            <div className="flex flex-col gap-2">
              {(question.options ?? []).map((option) => {
                const isSelected = question.correctOptionId === option.id;

                return (
                  <div
                    key={option.id}
                    className="group relative flex items-center gap-2 rounded-[2px] px-0 py-1 pr-[120px]"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={isSelected}
                      onChange={() =>
                        dispatch(
                          selectCorrectOption({
                            sectionId,
                            questionId: question.id,
                            optionId: option.id,
                          }),
                        )
                      }
                      className="h-4 w-4 border-[#232A25] text-[#49734F] focus:ring-0"
                    />
                    <textarea
                      ref={(element) => {
                        optionInputRefs.current[option.id] = element;
                        resizeTextarea(element);
                      }}
                      value={option.text}
                      onChange={(e) => {
                        resizeTextarea(e.currentTarget);
                        dispatch(
                          updateOptionText({
                            sectionId,
                            questionId: question.id,
                            optionId: option.id,
                            text: e.target.value,
                          }),
                        );
                      }}
                      onFocus={() => dispatch(setActiveQuestionId(question.id))}
                      placeholder="Option"
                      rows={1}
                      className="flex-1 resize-none overflow-hidden bg-transparent text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(
                          removeOption({
                            sectionId,
                            questionId: question.id,
                            optionId: option.id,
                          }),
                        )
                      }
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-[14px] leading-4 tracking-[-0.02em] text-[#D24B44] underline opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    >
                      Remove option
                    </button>
                  </div>
                );
              })}

              <button
                ref={addOptionButtonRef}
                type="button"
                onClick={handleAddOptionWithScroll}
                className="flex w-fit items-center gap-2 py-1 text-left text-[16px] font-[400] leading-4 tracking-[-0.02em] text-[rgba(116,119,117,0.5)]"
              >
                <span className="h-4 w-4 rounded-full border border-[rgba(116,119,117,0.5)]" />
                <span>Click to add a new option</span>
              </button>
            </div>
          )}

          {question.showValidation && (
            <p className="text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#D24B44]">
              Select the correct answer before adding a new question.
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Points</p>
              <input
                type="number"
                min={1}
                value={question.points}
                onChange={(e) =>
                  dispatch(
                    updateQuestionPoints({
                      sectionId,
                      questionId: question.id,
                      points: Number(e.target.value),
                    }),
                  )
                }
                className="h-8 w-16 rounded-[2px] border border-[#E5E5E5] bg-white px-2 text-[14px] leading-4 tracking-[-0.02em] text-[#232A25] outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              {sectionType === "objective" && (
                <button
                  type="button"
                  onClick={() => dispatch(shuffleOptions({ sectionId, questionId: question.id }))}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#232A25] transition-colors duration-150 hover:bg-[#49734F] hover:text-[#FFFFFF]"
                  aria-label="Shuffle options"
                >
                  <ShuffleIcon />
                </button>
              )}
              <button
                type="button"
                onClick={() => dispatch(duplicateQuestion({ sectionId, questionId: question.id }))}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#232A25] transition-colors duration-150 hover:bg-[#49734F] hover:text-[#FFFFFF]"
                aria-label="Duplicate question"
              >
                <CopyIconSVG />
              </button>
              <button
                type="button"
                onClick={() => dispatch(deleteQuestion({ sectionId, questionId: question.id }))}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150 hover:bg-[#D24B44] hover:text-[#FFFFFF]"
                aria-label="Delete question"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

QuestionCard.displayName = "QuestionCard";

export default QuestionCard;
