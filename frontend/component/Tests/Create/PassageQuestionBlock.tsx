import DragHandleIcon from "@/component/svg/DragHandleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import { RichTextEditor } from "@/component/RichTextEditor";
import {
  clearPendingFocusQuestionId,
  deleteQuestion,
  setActiveQuestionId,
  updatePassageInstructionLanguage,
  updatePassageText,
  updatePassageAudioUrl,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { getPassageInstructionByLanguage, hasRichTextContent } from "@/utils/richText";
import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn, focusRing, IconButton, Input } from "@/design/ui";
import QuestionCard from "./QuestionCard";
import QuestionCardValidation from "./QuestionCard/QuestionCardValidation";
import { QUESTION_BUILDER_GAPS } from "./QuestionCard/shared";

function PassageQuestionBlock({
  scrollContainerRef,
  passage,
  questionStartNumber,
  subjectId,
  setBlockRef,
  setQuestionRef,
  isActive,
  isDragging,
  isDragOverlay = false,
  cardStyle,
  overlayStyle,
  activeQuestionId,
  pendingFocusQuestion,
  pendingFocusOption,
  onDragHandlePointerDown,
}: PassageQuestionBlockProps) {
  const t = useTranslations("createTest.passage");
  const dispatch = useAppDispatch();
  const blockRef = useRef<HTMLDivElement>(null);
  const didAutoFocusRef = useRef(false);
  const shouldAutoFocusPassage =
    pendingFocusQuestion?.parentPassageId === passage.id && pendingFocusQuestion.questionId === null;
  const passageErrors =
    passage.showValidation && !hasRichTextContent(passage.passageText) ? [{ key: "passageMissing" as const }] : [];
  const instructionLanguage = passage.instructionLanguage === "en" ? "en" : "bn";
  const instructionLabel = getPassageInstructionByLanguage(instructionLanguage);

  const activatePassage = useCallback(() => {
    dispatch(
      setActiveQuestionId({
        questionId: null,
        parentPassageId: passage.id,
      }),
    );
  }, [dispatch, passage.id]);

  useEffect(() => {
    if (!shouldAutoFocusPassage || didAutoFocusRef.current) {
      return;
    }

    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      blockRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    dispatch(clearPendingFocusQuestionId());
  }, [dispatch, shouldAutoFocusPassage]);

  return (
    <div
      ref={(node) => {
        blockRef.current = node;
        setBlockRef(node);
      }}
      style={isDragOverlay ? overlayStyle : cardStyle}
      className={`flex w-full items-center ${QUESTION_BUILDER_GAPS.blockOuter} ${
        isDragOverlay ? "fixed z-50 pointer-events-none shadow-[0px_24px_60px_rgba(15,26,18,0.18)]" : ""
      } ${isDragging ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className={`flex w-full flex-col ${QUESTION_BUILDER_GAPS.passageInner} rounded-input border p-5 transition-[opacity,transform,box-shadow] duration-200 ${
          isActive ? "border-transparent bg-warning-soft" : "border-border bg-surface"
        }`}
      >
        <div
          className={`flex flex-col ${QUESTION_BUILDER_GAPS.passageHeader}`}
          onPointerDown={isDragOverlay ? undefined : activatePassage}
        >
          <div className={`flex items-start justify-between ${QUESTION_BUILDER_GAPS.passageHeaderRow}`}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p id={`${passage.id}-lang`} className="text-caption font-medium text-ink-muted">
                  {t("instructionLanguage")}
                </p>
                <div role="group" aria-labelledby={`${passage.id}-lang`} className="flex items-center rounded-input border border-border bg-surface p-0.5">
                  {(
                    [
                      { id: "bn", label: t("bangla") },
                      { id: "en", label: t("english") },
                    ] as const
                  ).map((option) => {
                    const isSelected = instructionLanguage === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          dispatch(
                            updatePassageInstructionLanguage({
                              subjectId,
                              passageId: passage.id,
                              instructionLanguage: option.id,
                            }),
                          );
                        }}
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-sm px-2.5 py-1 text-caption font-medium transition-colors",
                          isSelected ? "bg-primary text-ink-inverse" : "bg-transparent text-ink hover:bg-canvas",
                          focusRing,
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="max-w-[480px] text-body font-medium text-ink">
                {instructionLabel}
              </p>
            </div>
            <IconButton
              size="sm"
              className="text-danger hover:bg-danger-soft"
              label={t("delete")}
              icon={<TrashIcon />}
              onClick={() => dispatch(deleteQuestion({ subjectId, questionId: passage.id }))}
            />
          </div>
          <RichTextEditor
            value={passage.passageText}
            onChange={(html) =>
              dispatch(
                updatePassageText({
                  subjectId,
                  passageId: passage.id,
                  passageText: html,
                }),
              )
            }
            onFocus={activatePassage}
            placeholder={t("placeholder")}
            autoFocus={shouldAutoFocusPassage}
            minHeightClassName="min-h-[96px]"
            className="border-border bg-surface"
          />
          {subjectId.startsWith("ielts.listening") || subjectId.includes("listening") ? (
            <Input
              fieldClassName="mt-2"
              type="url"
              label={t("audio")}
              hint={t("audioHint")}
              value={passage.audioUrl ?? ""}
              onChange={(event) => dispatch(updatePassageAudioUrl({ subjectId, passageId: passage.id, audioUrl: event.target.value }))}
              placeholder="https://example.com/audio.mp3"
            />
          ) : null}
          <QuestionCardValidation showValidation={passage.showValidation} validationErrors={passageErrors} />
        </div>

        <div className={`flex flex-col ${QUESTION_BUILDER_GAPS.passageChildren}`}>
          {passage.childQuestions.map((question, index) => (
            <QuestionCard
              key={question.id}
              scrollContainerRef={scrollContainerRef}
              parentPassageId={passage.id}
              subjectId={subjectId}
              setCardRef={(node) => setQuestionRef(question.id, node)}
              question={question}
              questionNumber={questionStartNumber + index}
              isActive={isActive}
              shouldAutoFocus={
                pendingFocusQuestion?.parentPassageId === passage.id && pendingFocusQuestion.questionId === question.id
              }
              pendingFocusOptionId={
                pendingFocusOption?.parentPassageId === passage.id && pendingFocusOption.questionId === question.id
                  ? pendingFocusOption.optionId
                  : null
              }
              isDragging={false}
              showDragHandle={false}
              borderless
              onDragHandlePointerDown={onDragHandlePointerDown}
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onPointerDown={(event) => onDragHandlePointerDown(subjectId, passage.id, event)}
          className={cn("shrink-0 cursor-grab touch-none rounded-sm text-ink-muted transition-colors hover:text-ink active:cursor-grabbing", focusRing)}
          aria-label={t("drag")}
        >
          <DragHandleIcon />
        </button>
      </div>
    </div>
  );
}

export default memo(PassageQuestionBlock);
