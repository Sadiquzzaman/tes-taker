import PlusIcon from "@/component/svg/PlusIcon";
import { addQuestion, finishDragging, startDragging, updateDragging } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import QuestionCard from "./QuestionCard";

const QuestionsStep = memo(({ scrollContainerRef }: QuestionsStepProps) => {
  const dispatch = useAppDispatch();
  const { questionSections, activeQuestionId, pendingFocusQuestion, pendingFocusOption, dragState } = useAppSelector(
    (state) => state.createTest,
  );
  const sectionContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);

  const draggedSection = useMemo(
    () => questionSections.find((section) => section.id === dragState?.sectionId) ?? null,
    [dragState?.sectionId, questionSections],
  );

  const draggedQuestion = useMemo(
    () => draggedSection?.questions.find((question) => question.id === dragState?.id) ?? null,
    [dragState?.id, draggedSection],
  );

  const scrollElementIntoView = useCallback(
    (element: HTMLElement | null, behavior: ScrollBehavior = "smooth") => {
      const scrollContainer = scrollContainerRef.current;

      if (!scrollContainer || !element) {
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const topPadding = 16;
      const bottomPadding = 240;

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

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!pendingFocusQuestion) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollElementIntoView(itemRefs.current[pendingFocusQuestion.questionId]);
      });
    });
  }, [pendingFocusQuestion, scrollElementIntoView]);

  const handleStopDragging = useCallback(() => {
    if (!dragStateRef.current) {
      return;
    }

    dispatch(finishDragging());
    dragStateRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [dispatch]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const currentDragState = dragStateRef.current;

      if (!currentDragState) {
        return;
      }

      const section = questionSections.find((entry) => entry.id === currentDragState.sectionId);

      if (!section) {
        return;
      }

      let dropLineIndex = section.questions.length;

      for (let index = 0; index < section.questions.length; index += 1) {
        const element = itemRefs.current[section.questions[index].id];

        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          dropLineIndex = index;
          break;
        }
      }

      dispatch(
        updateDragging({
          pointerX: event.clientX,
          pointerY: event.clientY,
          dropLineIndex,
        }),
      );

      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        const scrollRect = scrollContainer.getBoundingClientRect();
        const edgeThreshold = 80;

        if (event.clientY > scrollRect.bottom - edgeThreshold) {
          scrollContainer.scrollTop += 18;
        } else if (event.clientY < scrollRect.top + edgeThreshold) {
          scrollContainer.scrollTop -= 18;
        }
      }
    },
    [dispatch, questionSections, scrollContainerRef],
  );

  useEffect(() => {
    if (!dragState) {
      return;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handleStopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleStopDragging);
    };
  }, [dragState, handlePointerMove, handleStopDragging]);

  const handleDragHandlePointerDown = useCallback(
    (sectionId: string, questionId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      const questionElement = itemRefs.current[questionId];

      if (!questionElement) {
        return;
      }

      event.preventDefault();

      const rect = questionElement.getBoundingClientRect();
      const section = questionSections.find((entry) => entry.id === sectionId);
      const draggedOriginalIndex = section?.questions.findIndex((question) => question.id === questionId) ?? -1;

      if (draggedOriginalIndex === -1) {
        return;
      }

      dispatch(
        startDragging({
          sectionId,
          id: questionId,
          draggedOriginalIndex,
          dropLineIndex: draggedOriginalIndex,
          pointerOffsetX: event.clientX - rect.left,
          pointerOffsetY: event.clientY - rect.top,
          pointerX: event.clientX,
          pointerY: event.clientY,
          width: rect.width,
        }),
      );

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    },
    [dispatch, questionSections],
  );

  return (
    <div className="flex min-h-[532px] w-full flex-1 flex-col gap-10">
      {questionSections.map((section) => {
        let dropIndicatorTop: number | null = null;
        const sectionContainer = sectionContainerRefs.current[section.id];

        if (dragState?.sectionId === section.id && sectionContainer) {
          const { dropLineIndex, draggedOriginalIndex } = dragState;

          if (dropLineIndex !== draggedOriginalIndex && dropLineIndex !== draggedOriginalIndex + 1) {
            const containerRect = sectionContainer.getBoundingClientRect();

            if (dropLineIndex <= 0) {
              const firstElement = itemRefs.current[section.questions[0]?.id];
              if (firstElement) {
                dropIndicatorTop = firstElement.getBoundingClientRect().top - containerRect.top - 9;
              }
            } else if (dropLineIndex >= section.questions.length) {
              const lastElement = itemRefs.current[section.questions[section.questions.length - 1]?.id];
              if (lastElement) {
                dropIndicatorTop = lastElement.getBoundingClientRect().bottom - containerRect.top + 7;
              }
            } else {
              const aboveElement = itemRefs.current[section.questions[dropLineIndex - 1]?.id];
              const belowElement = itemRefs.current[section.questions[dropLineIndex]?.id];

              if (aboveElement && belowElement) {
                const midY =
                  (aboveElement.getBoundingClientRect().bottom + belowElement.getBoundingClientRect().top) / 2;
                dropIndicatorTop = midY - containerRect.top - 1.5;
              }
            }
          }
        }

        const totalMarks = section.questions.reduce((sum, question) => sum + question.points, 0);

        return (
          <section key={section.id} className="flex w-full flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">
                {section.headerText}
              </h2>
            </div>
            <div className="w-full border-b border-[#E5E5E5]" />

            <div
              className={`relative flex flex-col gap-4 ${dragState?.sectionId === section.id ? "pointer-events-none" : ""}`}
              ref={(node) => {
                sectionContainerRefs.current[section.id] = node;
              }}
            >
              {section.questions.map((question, questionIndex) => (
                <QuestionCard
                  key={question.id}
                  scrollContainerRef={scrollContainerRef}
                  sectionId={section.id}
                  sectionType={section.type}
                  setCardRef={(node) => {
                    itemRefs.current[question.id] = node;
                  }}
                  question={question}
                  questionNumber={questionIndex + 1}
                  isActive={activeQuestionId === question.id}
                  shouldAutoFocus={
                    pendingFocusQuestion?.sectionId === section.id && pendingFocusQuestion.questionId === question.id
                  }
                  pendingFocusOptionId={
                    pendingFocusOption?.sectionId === section.id && pendingFocusOption.questionId === question.id
                      ? pendingFocusOption.optionId
                      : null
                  }
                  isDragging={dragState?.id === question.id}
                  onDragHandlePointerDown={handleDragHandlePointerDown}
                />
              ))}
              {dropIndicatorTop != null && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-10 h-[3px] rounded-full bg-[#49734F]"
                  style={{ top: dropIndicatorTop }}
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-6">
                <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                  Questions added: {String(section.questions.length).padStart(2, "0")}
                </p>
                <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">
                  Total marks: {String(totalMarks).padStart(2, "0")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dispatch(addQuestion(section.id))}
                className="flex h-8 items-center justify-center gap-2 rounded-[8px] border border-[#E5E5E5] bg-white px-4 text-[14px] leading-[16px] text-[#232A25]"
              >
                <PlusIcon />
                <span className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em]">Add Question</span>
              </button>
            </div>
          </section>
        );
      })}

      {dragState && draggedQuestion ? (
        <QuestionCard
          scrollContainerRef={scrollContainerRef}
          sectionId={dragState.sectionId}
          sectionType={draggedSection?.type ?? "objective"}
          question={draggedQuestion}
          questionNumber={
            (draggedSection?.questions.findIndex((question) => question.id === draggedQuestion.id) ?? 0) + 1
          }
          isActive
          shouldAutoFocus={false}
          pendingFocusOptionId={null}
          isDragging={false}
          isDragOverlay
          overlayStyle={{
            top: dragState.pointerY - dragState.pointerOffsetY,
            left: dragState.pointerX - dragState.pointerOffsetX,
            width: dragState.width,
          }}
          setCardRef={() => {}}
          onDragHandlePointerDown={(_sectionId, _questionId, _event) => {}}
        />
      ) : null}
    </div>
  );
});

QuestionsStep.displayName = "QuestionsStep";

export default QuestionsStep;
