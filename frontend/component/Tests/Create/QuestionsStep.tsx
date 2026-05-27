import { addQuestion, finishDragging, startDragging, updateDragging } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { createTestQuestionCategoryOptions, isCreateTestQuestionCreationSupported } from "@/utils/createTestOptions";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuestionCard from "./QuestionCard";

const QUESTION_CARD_GAP = 16;

const getDropLineIndexFromTargetIndex = (targetIndex: number, draggedOriginalIndex: number) =>
  targetIndex > draggedOriginalIndex ? targetIndex + 1 : targetIndex;

const getQuestionCardOffset = (questionIndex: number, dragState: DragState | null) => {
  if (!dragState || questionIndex === dragState.draggedOriginalIndex) {
    return 0;
  }

  const travelDistance = dragState.height + QUESTION_CARD_GAP;

  if (dragState.dropLineIndex > dragState.draggedOriginalIndex + 1) {
    return questionIndex > dragState.draggedOriginalIndex && questionIndex < dragState.dropLineIndex
      ? -travelDistance
      : 0;
  }

  if (dragState.dropLineIndex < dragState.draggedOriginalIndex) {
    return questionIndex >= dragState.dropLineIndex && questionIndex < dragState.draggedOriginalIndex
      ? travelDistance
      : 0;
  }

  return 0;
};

const QuestionsStep = memo(({ scrollContainerRef }: QuestionsStepProps) => {
  const dispatch = useAppDispatch();
  const defaultQuestionCategory = createTestQuestionCategoryOptions[0].id;
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const { subjects, activeSubjectId, activeQuestionId, pendingFocusQuestion, pendingFocusOption, dragState } =
    createTestState;
  const questionsContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const dragHandlePointerRef = useRef<{ element: HTMLButtonElement; pointerId: number } | null>(null);
  const [activeQuestionCategory, setActiveQuestionCategory] =
    useState<CreateTestQuestionCategory>(defaultQuestionCategory);

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.id === activeSubjectId) ?? subjects[0] ?? null,
    [activeSubjectId, subjects],
  );

  const questions = activeSubject?.questions ?? [];
  const questionCountLabel = String(questions.length).padStart(2, "0");
  const totalMarks = questions.reduce((sum, question) => sum + question.points, 0);
  const questionSubtypeTabs = useMemo(
    () => createTestQuestionCategoryOptions.find((category) => category.id === activeQuestionCategory)?.tabs ?? [],
    [activeQuestionCategory],
  );

  const draggedSubject = useMemo(
    () => subjects.find((subject) => subject.id === dragState?.subjectId) ?? null,
    [dragState?.subjectId, subjects],
  );

  const draggedQuestion = useMemo(
    () => draggedSubject?.questions.find((question) => question.id === dragState?.id) ?? null,
    [dragState?.id, draggedSubject],
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

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const currentDragState = dragStateRef.current;

      if (!currentDragState) {
        return;
      }

      const dragSubject = subjects.find((subject) => subject.id === currentDragState.subjectId);
      const subjectQuestions = dragSubject?.questions ?? [];

      if (subjectQuestions.length === 0) {
        return;
      }

      const containerRect = questionsContainerRef.current?.getBoundingClientRect();
      const clampedPointerY = containerRect
        ? Math.min(Math.max(event.clientY, containerRect.top), containerRect.bottom)
        : event.clientY;
      const otherQuestions = subjectQuestions.filter((question) => question.id !== currentDragState.id);
      let targetIndex = otherQuestions.length;

      for (let index = 0; index < otherQuestions.length; index += 1) {
        const element = itemRefs.current[otherQuestions[index].id];

        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (clampedPointerY < rect.top + rect.height / 2) {
          targetIndex = index;
          break;
        }
      }

      const dropLineIndex = getDropLineIndexFromTargetIndex(targetIndex, currentDragState.draggedOriginalIndex);

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
    [dispatch, scrollContainerRef, subjects],
  );

  const handleStopDragging = useCallback(
    function handleStopDraggingListener() {
      const currentDragState = dragStateRef.current;

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleStopDraggingListener);
      window.removeEventListener("pointercancel", handleStopDraggingListener);

      const dragHandlePointer = dragHandlePointerRef.current;
      if (dragHandlePointer?.element.hasPointerCapture(dragHandlePointer.pointerId)) {
        dragHandlePointer.element.releasePointerCapture(dragHandlePointer.pointerId);
      }
      dragHandlePointerRef.current = null;

      if (!currentDragState) {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        return;
      }

      dispatch(finishDragging());
      dragStateRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    },
    [dispatch, handlePointerMove],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleStopDragging);
      window.removeEventListener("pointercancel", handleStopDragging);

      const dragHandlePointer = dragHandlePointerRef.current;
      if (dragHandlePointer?.element.hasPointerCapture(dragHandlePointer.pointerId)) {
        dragHandlePointer.element.releasePointerCapture(dragHandlePointer.pointerId);
      }
    };
  }, [handlePointerMove, handleStopDragging]);

  const handleDragHandlePointerDown = useCallback(
    (subjectId: string, questionId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      const questionElement = itemRefs.current[questionId];

      if (!questionElement) {
        return;
      }

      event.preventDefault();

      const rect = questionElement.getBoundingClientRect();
      const dragSubject = subjects.find((subject) => subject.id === subjectId);
      const draggedOriginalIndex = dragSubject?.questions.findIndex((question) => question.id === questionId) ?? -1;

      if (draggedOriginalIndex === -1) {
        return;
      }

      const nextDragState: DragState = {
        subjectId,
        id: questionId,
        draggedOriginalIndex,
        dropLineIndex: draggedOriginalIndex,
        height: rect.height,
        left: rect.left,
        pointerOffsetX: event.clientX - rect.left,
        pointerOffsetY: event.clientY - rect.top,
        pointerX: event.clientX,
        pointerY: event.clientY,
        width: rect.width,
      };

      dragStateRef.current = nextDragState;
      dragHandlePointerRef.current = {
        element: event.currentTarget,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture(event.pointerId);

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleStopDragging);
      window.removeEventListener("pointercancel", handleStopDragging);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handleStopDragging);
      window.addEventListener("pointercancel", handleStopDragging);

      dispatch(startDragging(nextDragState));

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    },
    [dispatch, handlePointerMove, handleStopDragging, subjects],
  );

  const handleQuestionCategorySelect = useCallback((category: CreateTestQuestionCategory) => {
    setActiveQuestionCategory(category);
  }, []);

  const handleMakeQuestion = useCallback(
    (subType: string) => {
      if (!activeSubject || !isCreateTestQuestionCreationSupported(activeQuestionCategory, subType)) {
        return;
      }

      dispatch(
        addQuestion({
          subjectId: activeSubject.id,
          questionType: activeQuestionCategory,
          subType,
        }),
      );
    },
    [activeQuestionCategory, activeSubject, dispatch],
  );

  const renderedQuestions = questions.map((question, questionIndex) => {
    return (
      <QuestionCard
        key={question.id}
        scrollContainerRef={scrollContainerRef}
        subjectId={activeSubject!.id}
        setCardRef={(node) => {
          itemRefs.current[question.id] = node;
        }}
        question={question}
        questionNumber={questionIndex + 1}
        isActive={activeQuestionId === question.id}
        shouldAutoFocus={
          pendingFocusQuestion?.subjectId === activeSubject?.id && pendingFocusQuestion.questionId === question.id
        }
        pendingFocusOptionId={
          pendingFocusOption?.subjectId === activeSubject?.id && pendingFocusOption.questionId === question.id
            ? pendingFocusOption.optionId
            : null
        }
        isDragging={dragState?.id === question.id}
        cardStyle={
          dragState?.subjectId === activeSubject?.id
            ? {
                transform: `translateY(${getQuestionCardOffset(questionIndex, dragState)}px)`,
                transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
                willChange: "transform",
              }
            : undefined
        }
        onDragHandlePointerDown={handleDragHandlePointerDown}
      />
    );
  });

  const dragOverlay =
    dragState && draggedQuestion && draggedSubject
      ? (() => {
          const containerRect = questionsContainerRef.current?.getBoundingClientRect();
          const unclampedTop = dragState.pointerY - dragState.pointerOffsetY;
          const top = containerRect
            ? Math.min(Math.max(unclampedTop, containerRect.top), containerRect.bottom - dragState.height)
            : unclampedTop;

          return (
            <QuestionCard
              scrollContainerRef={scrollContainerRef}
              subjectId={draggedSubject.id}
              question={draggedQuestion}
              questionNumber={
                (draggedSubject.questions.findIndex((question) => question.id === draggedQuestion.id) ?? 0) + 1
              }
              isActive
              shouldAutoFocus={false}
              pendingFocusOptionId={null}
              isDragging={false}
              isDragOverlay
              overlayStyle={{
                top,
                left: dragState.left,
                width: dragState.width,
              }}
              setCardRef={() => {}}
              onDragHandlePointerDown={() => {}}
            />
          );
        })()
      : null;

  return (
    <div className="flex min-h-[532px] w-full flex-1 flex-col gap-10">
      <section className="flex w-full flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Question</h2>
          </div>
        </div>
        <div className="w-full border-b border-[#E5E5E5]" />

        <div className="flex w-full max-w-[524px] items-center justify-between gap-6">
          <div className="flex items-center gap-1">
            <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]">Questions added:</p>
            <p className="text-[14px] font-[600] leading-[16px] tracking-[-0.02em] text-[#747775]">
              {questionCountLabel}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]">Total marks:</p>
            <p className="text-[14px] font-[600] leading-[16px] tracking-[-0.02em] text-[#747775]">
              {String(totalMarks).padStart(2, "0")}
            </p>
          </div>
        </div>

        <div
          className={`relative flex flex-col gap-4 ${dragState?.subjectId === activeSubject?.id ? "pointer-events-none" : ""}`}
          ref={questionsContainerRef}
        >
          {renderedQuestions}
        </div>

        <div className="flex flex-col gap-0">
          <div className="flex w-fit items-center gap-2 rounded-[8px] border border-[#49734F] bg-white p-1">
            {createTestQuestionCategoryOptions.map((category) => {
              const isActive = activeQuestionCategory === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleQuestionCategorySelect(category.id)}
                  className={`flex h-9 min-w-[79px] items-center justify-center rounded-[6px] px-4 text-[14px] font-[400] leading-[17px] tracking-[-0.02em] transition-none ${
                    isActive ? "bg-[#49734F] text-white" : "bg-[#EFF0F3] text-[#232A25]"
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </div>

          <div className="flex w-full max-w-[524px] items-center gap-1 overflow-x-auto rounded-tr-[6px] rounded-br-[6px] rounded-bl-[6px] rounded-tl-none bg-[#49734F] p-1">
            {questionSubtypeTabs.map((tab) => {
              return (
                <button
                  key={`${activeQuestionCategory}-${tab.id}`}
                  type="button"
                  onClick={() => handleMakeQuestion(tab.id)}
                  className="flex h-[50px] flex-1 items-center justify-center rounded-[6px] bg-[rgba(255,255,255,0.05)] px-3 text-[14px] font-[400] leading-[17px] tracking-[-0.02em] text-white transition-colors hover:bg-white hover:text-[#232A25]"
                >
                  <span className="flex items-center text-left">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {dragOverlay}
    </div>
  );
});

QuestionsStep.displayName = "QuestionsStep";

export default QuestionsStep;
