import {
  addMatchingPair,
  clearPendingFocusOption,
  removeMatchingPair,
  updateMatchingOptionText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo, useCallback, useEffect, useRef } from "react";
import QuestionCardMatchingRow from "./QuestionCardMatchingRow";
import { QUESTION_BUILDER_GAPS, resizeTextarea } from "./shared";

function QuestionCardMatchingBody({
  activateCard,
  canAddMorePairs,
  leftOptions,
  maxPairs,
  pendingFocusOptionId,
  parentPassageId,
  questionId,
  rightOptions,
  scrollContainerRef,
  scrollElementIntoView,
  subjectId,
}: QuestionCardMatchingBodyProps) {
  const dispatch = useAppDispatch();
  const addPairButtonRef = useRef<HTMLButtonElement>(null);
  const leftInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const rightInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const scrollToListEndIfNeeded = useCallback(() => {
    if (!addPairButtonRef.current || !scrollContainerRef.current) return;
    const buttonRect = addPairButtonRef.current.getBoundingClientRect();
    const scrollRect = scrollContainerRef.current.getBoundingClientRect();
    if (scrollRect.bottom - buttonRect.bottom <= 30) {
      setTimeout(
        () =>
          scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" }),
        0,
      );
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    if (!pendingFocusOptionId) return;
    const input = leftInputRefs.current[pendingFocusOptionId];
    if (!input) return;
    input.focus();
    requestAnimationFrame(() => scrollElementIntoView(input));
    dispatch(clearPendingFocusOption());
  }, [dispatch, leftOptions, pendingFocusOptionId, scrollElementIntoView]);

  useEffect(() => {
    Object.values(leftInputRefs.current).forEach((element) => resizeTextarea(element));
    Object.values(rightInputRefs.current).forEach((element) => resizeTextarea(element));
  }, [leftOptions, rightOptions]);

  return (
    <div className={`flex flex-col ${QUESTION_BUILDER_GAPS.matchingBody}`}>
      {leftOptions.map((leftOption, index) => {
        const rightOption = rightOptions[index];
        if (!rightOption) return null;
        return (
          <QuestionCardMatchingRow
            key={leftOption.id}
            activateCard={activateCard}
            index={index}
            leftOption={leftOption}
            onLeftChange={(event) =>
              dispatch(
                updateMatchingOptionText({
                  subjectId,
                  questionId,
                  optionId: leftOption.id,
                  side: "left",
                  text: event.target.value,
                  parentPassageId,
                }),
              )
            }
            onRemove={() => dispatch(removeMatchingPair({ subjectId, questionId, pairIndex: index, parentPassageId }))}
            onRightChange={(event) =>
              dispatch(
                updateMatchingOptionText({
                  subjectId,
                  questionId,
                  optionId: rightOption.id,
                  side: "right",
                  text: event.target.value,
                  parentPassageId,
                }),
              )
            }
            rightOption={rightOption}
            setLeftInputRef={(element) => {
              leftInputRefs.current[leftOption.id] = element;
            }}
            setRightInputRef={(element) => {
              rightInputRefs.current[rightOption.id] = element;
            }}
          />
        );
      })}
      <button
        ref={addPairButtonRef}
        type="button"
        onClick={() => {
          dispatch(addMatchingPair({ subjectId, questionId, parentPassageId }));
          activateCard();
          scrollToListEndIfNeeded();
        }}
        disabled={!canAddMorePairs}
        className={`flex items-center ${QUESTION_BUILDER_GAPS.matchingAddButton} py-1 text-left text-[16px] font-[400] leading-4 tracking-[-0.02em] text-[rgba(116,119,117,0.5)] disabled:cursor-default`}
      >
        <span>{canAddMorePairs ? "Add Another Choice" : `Maximum ${maxPairs} pairs added`}</span>
      </button>
    </div>
  );
}

export default memo(QuestionCardMatchingBody);
