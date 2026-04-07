import PlusIcon from "@/component/svg/PlusIcon";
import {
  addQuestion,
  addSubject,
  finishDragging,
  setActiveSubjectId,
  startDragging,
  updateDragging,
} from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { createTestSubjectOptions } from "@/utils/createTestOptions";
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
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const {
    formState,
    subjects,
    activeSubjectId,
    activeQuestionId,
    pendingFocusQuestion,
    pendingFocusOption,
    dragState,
  } = createTestState;
  const [isAddSubjectMenuOpen, setIsAddSubjectMenuOpen] = useState(false);
  const sectionContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const subjectScrollRef = useRef<HTMLDivElement>(null);
  const subjectButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isSubjectScrollDragging = useRef(false);
  const subjectScrollStartX = useRef(0);
  const subjectScrollStartLeft = useRef(0);

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.id === activeSubjectId) ?? subjects[0] ?? null,
    [activeSubjectId, subjects],
  );

  const questionSections = activeSubject?.questionSections ?? [];

  const remainingSubjectOptions = useMemo(
    () => createTestSubjectOptions.filter((option) => !subjects.some((subject) => subject.value === option.value)),
    [subjects],
  );

  const draggedSubject = useMemo(
    () => subjects.find((subject) => subject.id === dragState?.subjectId) ?? null,
    [dragState?.subjectId, subjects],
  );

  const draggedSection = useMemo(
    () => draggedSubject?.questionSections.find((section) => section.id === dragState?.sectionId) ?? null,
    [dragState?.sectionId, draggedSubject],
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

  useEffect(() => {
    if (formState.examType !== "model") {
      setIsAddSubjectMenuOpen(false);
    }
  }, [formState.examType]);

  useEffect(() => {
    const scrollContainer = subjectScrollRef.current;
    if (!activeSubjectId || !scrollContainer) return;
    const activeButton = subjectButtonRefs.current[activeSubjectId];
    if (!activeButton) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const buttonScrollLeft = scrollContainer.scrollLeft + buttonRect.left - containerRect.left;
    const scrollTarget = buttonScrollLeft - scrollContainer.clientWidth / 2 + buttonRect.width / 2;
    scrollContainer.scrollTo({ left: scrollTarget, behavior: "smooth" });
  }, [activeSubjectId]);

  const handleSubjectScrollMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = subjectScrollRef.current;
    if (!el) return;
    isSubjectScrollDragging.current = true;
    subjectScrollStartX.current = e.clientX;
    subjectScrollStartLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const handleSubjectScrollMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSubjectScrollDragging.current || !subjectScrollRef.current) return;
    const dx = e.clientX - subjectScrollStartX.current;
    subjectScrollRef.current.scrollLeft = subjectScrollStartLeft.current - dx;
  }, []);

  const handleSubjectScrollMouseUp = useCallback(() => {
    if (!subjectScrollRef.current) return;
    isSubjectScrollDragging.current = false;
    subjectScrollRef.current.style.cursor = "";
    subjectScrollRef.current.style.userSelect = "";
  }, []);

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

      const dragSubject = subjects.find((subject) => subject.id === currentDragState.subjectId);
      const section = dragSubject?.questionSections.find((entry) => entry.id === currentDragState.sectionId);

      if (!section) {
        return;
      }

      const sectionContainer = sectionContainerRefs.current[currentDragState.sectionId];
      const sectionRect = sectionContainer?.getBoundingClientRect();
      const clampedPointerY = sectionRect
        ? Math.min(Math.max(event.clientY, sectionRect.top), sectionRect.bottom)
        : event.clientY;
      const otherQuestions = section.questions.filter((question) => question.id !== currentDragState.id);
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
    (subjectId: string, sectionId: string, questionId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      const questionElement = itemRefs.current[questionId];

      if (!questionElement) {
        return;
      }

      event.preventDefault();

      const rect = questionElement.getBoundingClientRect();
      const dragSubject = subjects.find((subject) => subject.id === subjectId);
      const section = dragSubject?.questionSections.find((entry) => entry.id === sectionId);
      const draggedOriginalIndex = section?.questions.findIndex((question) => question.id === questionId) ?? -1;

      if (draggedOriginalIndex === -1) {
        return;
      }

      dispatch(
        startDragging({
          subjectId,
          sectionId,
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
        }),
      );

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    },
    [dispatch, subjects],
  );

  const handleAddSubject = useCallback(
    (subjectOption: { label: string; value: string }) => {
      dispatch(addSubject(subjectOption));
      setIsAddSubjectMenuOpen(false);
    },
    [dispatch],
  );

  return (
    <div className="flex min-h-[532px] w-full flex-1 flex-col gap-10">
      {formState.examType === "model" && (
        <section className="flex flex-col gap-4">
          <div className="flex w-fit max-w-full items-center gap-2 bg-[#EFF0F3] h-10 p-1 rounded-[6px]">
            <div
              ref={subjectScrollRef}
              className="flex gap-2 items-center overflow-x-auto min-w-0 h-full scrollbar-hide cursor-grab"
              onMouseDown={handleSubjectScrollMouseDown}
              onMouseMove={handleSubjectScrollMouseMove}
              onMouseUp={handleSubjectScrollMouseUp}
              onMouseLeave={handleSubjectScrollMouseUp}
            >
              {subjects.map((subject) => {
                const isActiveSubject = subject.id === activeSubject.id;

                return (
                  <button
                    key={subject.id}
                    ref={(node) => {
                      subjectButtonRefs.current[subject.id] = node;
                    }}
                    type="button"
                    onClick={() => dispatch(setActiveSubjectId(subject.id))}
                    className={`rounded-[4px] h-full flex-shrink-0 flex items-center justify-center px-3 text-[14px] font-[400] leading-[16px] tracking-[-0.02em] whitespace-nowrap 
                      ${isActiveSubject ? "text-white bg-[#49734F]" : "bg-white text-[#232A25]"}`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsAddSubjectMenuOpen((current) => !current)}
                disabled={remainingSubjectOptions.length === 0}
                className="text-[#232A25] flex items-center justify-center px-1 text-[14px] font-[400] leading-[16px] tracking-[-0.02em] whitespace-nowrap disabled:opacity-50"
              >
                <PlusIcon />
                <span className="ml-1">Add Subject</span>
              </button>
              {isAddSubjectMenuOpen && remainingSubjectOptions.length > 0 && (
                <div
                  className={`absolute ${activeSubject ? "right-0" : "left-0"} top-full z-20 mt-2 min-w-[220px] rounded-[12px] border border-[#E5E5E5] bg-white p-2 shadow-[0px_16px_40px_rgba(15,26,18,0.12)]`}
                >
                  {remainingSubjectOptions.map((subjectOption) => (
                    <button
                      key={subjectOption.value}
                      type="button"
                      onClick={() => handleAddSubject(subjectOption)}
                      className="flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[14px] font-[500] leading-[16px] text-[#232A25] transition-colors hover:bg-[#49734F0D]"
                    >
                      {subjectOption.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!activeSubject && (
            <div className="w-full rounded-[12px] border border-dashed border-[#DADCE0] bg-[#FAFBFA] px-5 py-10 text-center">
              <p className="text-[16px] font-[500] leading-[24px] tracking-[-0.02em] text-[#232A25]">
                {formState.examType === "model"
                  ? "Add a subject to start creating questions."
                  : "Select a subject in Basic Info to start creating questions."}
              </p>
            </div>
          )}
        </section>
      )}

      {questionSections.map((section) => {
        let dropIndicatorTop: number | null = null;
        const sectionContainer = sectionContainerRefs.current[section.id];

        if (dragState?.subjectId === activeSubject.id && dragState.sectionId === section.id && sectionContainer) {
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
              className={`relative flex flex-col gap-4 ${
                dragState?.subjectId === activeSubject.id && dragState.sectionId === section.id
                  ? "pointer-events-none"
                  : ""
              }`}
              ref={(node) => {
                sectionContainerRefs.current[section.id] = node;
              }}
            >
              {section.questions.map((question, questionIndex) => (
                <QuestionCard
                  key={question.id}
                  scrollContainerRef={scrollContainerRef}
                  subjectId={activeSubject.id}
                  sectionId={section.id}
                  sectionType={section.type}
                  setCardRef={(node) => {
                    itemRefs.current[question.id] = node;
                  }}
                  question={question}
                  questionNumber={questionIndex + 1}
                  isActive={activeQuestionId === question.id}
                  shouldAutoFocus={
                    pendingFocusQuestion?.subjectId === activeSubject.id &&
                    pendingFocusQuestion.sectionId === section.id &&
                    pendingFocusQuestion.questionId === question.id
                  }
                  pendingFocusOptionId={
                    pendingFocusOption?.subjectId === activeSubject.id &&
                    pendingFocusOption.sectionId === section.id &&
                    pendingFocusOption.questionId === question.id
                      ? pendingFocusOption.optionId
                      : null
                  }
                  isDragging={dragState?.id === question.id}
                  cardStyle={
                    dragState?.subjectId === activeSubject.id && dragState.sectionId === section.id
                      ? {
                          transform: `translateY(${getQuestionCardOffset(questionIndex, dragState)}px)`,
                          transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
                          willChange: "transform",
                        }
                      : undefined
                  }
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
                onClick={() => dispatch(addQuestion({ subjectId: activeSubject.id, sectionId: section.id }))}
                className="flex h-8 items-center justify-center gap-2 rounded-[8px] border border-[#E5E5E5] bg-white px-4 text-[14px] leading-[16px] text-[#232A25]"
              >
                <PlusIcon />
                <span className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em]">Add Question</span>
              </button>
            </div>
          </section>
        );
      })}

      {dragState && draggedQuestion && draggedSubject && draggedSection
        ? (() => {
            const sectionContainer = sectionContainerRefs.current[dragState.sectionId];
            const sectionRect = sectionContainer?.getBoundingClientRect();
            const unclampedTop = dragState.pointerY - dragState.pointerOffsetY;
            const top = sectionRect
              ? Math.min(Math.max(unclampedTop, sectionRect.top), sectionRect.bottom - dragState.height)
              : unclampedTop;

            return (
              <QuestionCard
                scrollContainerRef={scrollContainerRef}
                subjectId={draggedSubject.id}
                sectionId={dragState.sectionId}
                sectionType={draggedSection.type}
                question={draggedQuestion}
                questionNumber={
                  (draggedSection.questions.findIndex((question) => question.id === draggedQuestion.id) ?? 0) + 1
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
                onDragHandlePointerDown={(_subjectId, _sectionId, _questionId, _event) => {}}
              />
            );
          })()
        : null}
    </div>
  );
});

QuestionsStep.displayName = "QuestionsStep";

export default QuestionsStep;
