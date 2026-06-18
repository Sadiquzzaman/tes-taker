import DragHandleIcon from "@/component/svg/DragHandleIcon";
import { buildMatchingAnswerPairs, getMatchingRightOptionOrder } from "@/utils/tests/studentExamAnswers";
import { useEffect, useMemo, useRef, useState } from "react";

interface StudentExamMatchingOrderInputProps {
  answerState: ExamAnswerState;
  disabled: boolean;
  questionId: string;
  matchingOptions: {
    left: StudentExamMatchingOption[];
    right: StudentExamMatchingOption[];
  };
  onMatchingChange: (questionId: string, value: string[]) => void;
}

interface MatchingDragState {
  containerTop: number;
  itemHeight: number;
  itemWidth: number;
  pointerOffsetY: number;
  pointerY: number;
  sourceIndex: number;
  targetIndex: number;
}

const MATCHING_ROW_GAP = 6;

const moveRightOptionToIndex = (
  rightOptions: StudentExamMatchingOption[],
  sourceIndex: number,
  targetIndex: number,
): StudentExamMatchingOption[] => {
  const nextOptions = [...rightOptions];
  const [draggedOption] = nextOptions.splice(sourceIndex, 1);

  if (!draggedOption) {
    return rightOptions;
  }

  nextOptions.splice(targetIndex, 0, draggedOption);
  return nextOptions;
};

const clampIndex = (value: number, maxIndex: number) => {
  if (value < 0) {
    return 0;
  }

  if (value > maxIndex) {
    return maxIndex;
  }

  return value;
};

const StudentExamMatchingOrderInput = ({
  answerState,
  disabled,
  questionId,
  matchingOptions,
  onMatchingChange,
}: StudentExamMatchingOrderInputProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentValue = answerState[questionId];
  const [dragState, setDragState] = useState<MatchingDragState | null>(null);
  const orderedRightOptions = useMemo(
    () => getMatchingRightOptionOrder(currentValue, matchingOptions.left, matchingOptions.right),
    [currentValue, matchingOptions.left, matchingOptions.right],
  );

  const previewRightOptions = useMemo(() => {
    if (!dragState) {
      return orderedRightOptions;
    }

    return moveRightOptionToIndex(orderedRightOptions, dragState.sourceIndex, dragState.targetIndex);
  }, [dragState, orderedRightOptions]);

  useEffect(() => {
    if (!dragState || disabled) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (!containerRect) {
        return;
      }

      const pointerCenterY = event.clientY - containerRect.top - dragState.pointerOffsetY + dragState.itemHeight / 2;
      const slotHeight = dragState.itemHeight + MATCHING_ROW_GAP;
      const nextTargetIndex = clampIndex(
        Math.floor((pointerCenterY + MATCHING_ROW_GAP / 2) / slotHeight),
        orderedRightOptions.length - 1,
      );

      setDragState((currentDragState) => {
        if (!currentDragState) {
          return null;
        }

        return {
          ...currentDragState,
          pointerY: event.clientY,
          targetIndex: nextTargetIndex,
        };
      });
    };

    const finishDrag = () => {
      if (!dragState) {
        return;
      }

      const { sourceIndex, targetIndex } = dragState;
      setDragState(null);

      if (sourceIndex !== targetIndex) {
        const nextOrderedRightOptions = moveRightOptionToIndex(orderedRightOptions, sourceIndex, targetIndex);
        onMatchingChange(questionId, buildMatchingAnswerPairs(matchingOptions.left, nextOrderedRightOptions));
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [disabled, dragState, matchingOptions.left, onMatchingChange, orderedRightOptions, questionId]);

  return (
    <div className="grid gap-x-2 gap-y-[6px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-[6px]">
        {matchingOptions.left.map((leftOption, index) => (
          <div
            key={leftOption.id}
            className="flex items-center px-3 py-2 text-[16px] leading-5 tracking-[-0.02em] text-[#232A25]"
          >
            <span className="mr-3 text-[#747775]">{index + 1}.</span>
            <span>{leftOption.text}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="relative flex flex-col gap-[6px]">
        {previewRightOptions.map((rightOption) => {
          const isDraggingOption =
            dragState !== null && rightOption.id === orderedRightOptions[dragState.sourceIndex]?.id;

          if (isDraggingOption) {
            return <div key={rightOption.id} style={{ height: `${dragState.itemHeight}px` }} />;
          }

          return (
            <div
              key={rightOption.id}
              className="flex items-center gap-3 px-3 py-2 text-[16px] leading-5 tracking-[-0.02em] text-[#232A25] transition-transform duration-150 ease-out"
            >
              <button
                type="button"
                disabled={disabled}
                onPointerDown={(event) => {
                  if (disabled) {
                    return;
                  }

                  const rowElement = event.currentTarget.parentElement;
                  const rowRect = rowElement?.getBoundingClientRect();
                  const containerRect = containerRef.current?.getBoundingClientRect();

                  if (!rowRect || !containerRect) {
                    return;
                  }

                  event.preventDefault();

                  const draggedOptionIndex = orderedRightOptions.findIndex((option) => option.id === rightOption.id);

                  setDragState({
                    containerTop: containerRect.top,
                    itemHeight: rowRect.height,
                    itemWidth: rowRect.width,
                    pointerOffsetY: event.clientY - rowRect.top,
                    pointerY: event.clientY,
                    sourceIndex: draggedOptionIndex,
                    targetIndex: draggedOptionIndex,
                  });
                }}
                className={`touch-none text-[#747775] ${disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                aria-label="Drag to reorder"
              >
                <DragHandleIcon />
              </button>
              <span>{rightOption.text}</span>
            </div>
          );
        })}

        {dragState ? (
          <div
            className="pointer-events-none absolute left-0 top-0 z-20 flex min-h-[44px] items-center gap-3 px-3 py-[10px] text-[16px] leading-5 tracking-[-0.02em] text-[#232A25] opacity-95 shadow-[0_10px_30px_rgba(15,26,18,0.12)]"
            style={{
              transform: `translate3d(0, ${dragState.pointerY - dragState.containerTop - dragState.pointerOffsetY}px, 0)`,
              width: `${dragState.itemWidth}px`,
            }}
          >
            <div className="text-[#49734F]">
              <DragHandleIcon />
            </div>
            <span>{orderedRightOptions[dragState.sourceIndex]?.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StudentExamMatchingOrderInput;
