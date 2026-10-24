"use client";

import { cancelDragging, moveGlobalQuestion, startDragging, updateDragging } from "@/lib/features/createTestSlice";
import { useTranslations } from "next-intl";
import { Badge, cn, focusRing, IconButton } from "@/design/ui";
import { ChevronDownIcon, ChevronUpIcon } from "@/design/ui/icons";
import { isPassageQuestionItem } from "@/lib/features/create-test/createTestDomain";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

const ROW_GAP = 8;

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const getDropLineIndexFromTargetIndex = (targetIndex: number, draggedOriginalIndex: number) =>
  targetIndex > draggedOriginalIndex ? targetIndex + 1 : targetIndex;

const getRowOffset = (questionIndex: number, dragState: DragState | null) => {
  if (!dragState || questionIndex === dragState.draggedOriginalIndex) {
    return 0;
  }

  const travelDistance = dragState.height + ROW_GAP;

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

const ReorderStep = memo(() => {
  const t = useTranslations("createTest.reorder");
  const tc = useTranslations("createTest");
  const dispatch = useAppDispatch();
  const { subjects, questionOrder, dragState } = useAppSelector((state) => state.createTest) as CreateTestState;
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const dragListenersRef = useRef<AbortController | null>(null);

  const flatQuestions = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; subjectId: string; subjectName: string; title: string; points: number; isPassage: boolean }
    >();

    for (const subject of subjects) {
      for (const question of subject.questions) {
        if (isPassageQuestionItem(question)) {
          byId.set(question.id, {
            id: question.id,
            subjectId: subject.id,
            subjectName: subject.name,
            title: stripHtml(question.passageText) || "",
            points: question.childQuestions.reduce((total, child) => total + child.points, 0),
            isPassage: true,
          });
        } else {
          byId.set(question.id, {
            id: question.id,
            subjectId: subject.id,
            subjectName: subject.name,
            title: stripHtml(question.text) || "",
            points: question.points,
            isPassage: false,
          });
        }
      }
    }

    const order =
      questionOrder.length > 0 ? questionOrder : subjects.flatMap((subject) => subject.questions.map((q) => q.id));

    return order.map((id) => byId.get(id)).filter(Boolean) as {
      id: string;
      subjectId: string;
      subjectName: string;
      title: string;
      points: number;
      isPassage: boolean;
    }[];
  }, [questionOrder, subjects]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current || !listRef.current) {
        return;
      }

      const rows = flatQuestions
        .map((question, index) => {
          const node = itemRefs.current[question.id];
          if (!node) {
            return null;
          }
          const rect = node.getBoundingClientRect();
          return { index, midY: rect.top + rect.height / 2 };
        })
        .filter(Boolean) as { index: number; midY: number }[];

      let targetIndex = flatQuestions.length - 1;
      for (const row of rows) {
        if (event.clientY < row.midY) {
          targetIndex = row.index;
          break;
        }
      }

      dispatch(
        updateDragging({
          ...current,
          pointerX: event.clientX,
          pointerY: event.clientY,
          dropLineIndex: getDropLineIndexFromTargetIndex(targetIndex, current.draggedOriginalIndex),
        }),
      );
    },
    [dispatch, flatQuestions],
  );

  const handleStopDragging = useCallback(() => {
    const current = dragStateRef.current;
    dragListenersRef.current?.abort();
    dragListenersRef.current = null;

    if (current) {
      const { id, draggedOriginalIndex, dropLineIndex } = current;
      if (dropLineIndex !== draggedOriginalIndex && dropLineIndex !== draggedOriginalIndex + 1) {
        const targetIndex = dropLineIndex > draggedOriginalIndex ? dropLineIndex - 1 : dropLineIndex;
        dispatch(moveGlobalQuestion({ questionId: id, targetIndex }));
      }
    }

    dispatch(cancelDragging());
  }, [dispatch]);

  const handleDragHandlePointerDown = useCallback(
    (questionId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const node = itemRefs.current[questionId];
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const draggedOriginalIndex = flatQuestions.findIndex((question) => question.id === questionId);
      if (draggedOriginalIndex < 0) {
        return;
      }

      const nextDragState: DragState = {
        subjectId: flatQuestions[draggedOriginalIndex]?.subjectId ?? "",
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

      dispatch(startDragging(nextDragState));
      dragListenersRef.current?.abort();
      const dragListeners = new AbortController();
      dragListenersRef.current = dragListeners;
      window.addEventListener("pointermove", handlePointerMove, { signal: dragListeners.signal });
      window.addEventListener("pointerup", handleStopDragging, { signal: dragListeners.signal });
      window.addEventListener("pointercancel", handleStopDragging, { signal: dragListeners.signal });
    },
    [dispatch, flatQuestions, handlePointerMove, handleStopDragging],
  );

  const draggedItem = dragState ? flatQuestions.find((question) => question.id === dragState.id) : null;

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-title-sm font-semibold text-ink">{t("title")}</h2>
        <p className="text-body-sm text-ink-muted">{t("intro")}</p>
      </div>

      <div ref={listRef} className="relative flex flex-col gap-2">
        {flatQuestions.map((question, index) => {
          const isDragging = dragState?.id === question.id;
          return (
            <div
              key={question.id}
              ref={(node) => {
                itemRefs.current[question.id] = node;
              }}
              style={{
                transform: `translateY(${getRowOffset(index, dragState)}px)`,
                transition: "transform 180ms ease",
                opacity: isDragging ? 0.35 : 1,
              }}
              className="flex items-center gap-3 rounded-input border border-border bg-surface px-3 py-3"
            >
              <button
                type="button"
                onPointerDown={(event) => handleDragHandlePointerDown(question.id, event)}
                className={cn("cursor-grab touch-none rounded-sm px-1 text-ink-muted active:cursor-grabbing", focusRing)}
                aria-label={t("drag")}
                tabIndex={-1}
              >
                ⋮⋮
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-semibold text-primary">{t("questionNumber", { number: index + 1 })}</span>
                  <Badge>{question.subjectName}</Badge>
                  <span className="text-caption text-ink-muted">{tc("pointsCount", { points: question.points })}</span>
                </div>
                <p className="truncate text-body-sm text-ink">{question.title || (question.isPassage ? t("passageQuestion") : t("untitled"))}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  size="sm"
                  label={t("moveUp", { number: index + 1 })}
                  icon={<ChevronUpIcon />}
                  disabled={index === 0}
                  onClick={() => dispatch(moveGlobalQuestion({ questionId: question.id, targetIndex: index - 1 }))}
                />
                <IconButton
                  size="sm"
                  label={t("moveDown", { number: index + 1 })}
                  icon={<ChevronDownIcon />}
                  disabled={index === flatQuestions.length - 1}
                  onClick={() => dispatch(moveGlobalQuestion({ questionId: question.id, targetIndex: index + 1 }))}
                />
              </div>
            </div>
          );
        })}

        {dragState && draggedItem ? (
          <div
            className="pointer-events-none fixed z-50 flex items-center gap-3 rounded-input border border-primary bg-surface px-3 py-3 shadow-lg"
            style={{
              top: dragState.pointerY - dragState.pointerOffsetY,
              left: dragState.left,
              width: dragState.width,
            }}
          >
            <span className="text-ink-muted">⋮⋮</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm text-ink">{draggedItem.title}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
});

ReorderStep.displayName = "ReorderStep";

export default ReorderStep;
