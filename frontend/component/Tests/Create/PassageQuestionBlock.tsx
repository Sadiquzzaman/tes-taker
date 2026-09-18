import DragHandleIcon from "@/component/svg/DragHandleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import { RichTextEditor } from "@/component/RichTextEditor";
import {
  clearPendingFocusQuestionId,
  deleteQuestion,
  setActiveQuestionId,
  updatePassageInstructionLanguage,
  updatePassageText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { getPassageInstructionByLanguage, hasRichTextContent } from "@/utils/richText";
import { memo, useCallback, useEffect, useRef } from "react";
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
  const dispatch = useAppDispatch();
  const blockRef = useRef<HTMLDivElement>(null);
  const didAutoFocusRef = useRef(false);
  const shouldAutoFocusPassage =
    pendingFocusQuestion?.parentPassageId === passage.id && pendingFocusQuestion.questionId === null;
  const passageErrors =
    passage.showValidation && !hasRichTextContent(passage.passageText) ? ["Add passage text."] : [];
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
        className={`flex w-full flex-col ${QUESTION_BUILDER_GAPS.passageInner} rounded-[8px] border p-5 transition-[opacity,transform,box-shadow] duration-200 ${
          isActive ? "border-transparent bg-[#FDF3E5]" : "border-[#E5E5E5] bg-white"
        }`}
      >
        <div
          className={`flex flex-col ${QUESTION_BUILDER_GAPS.passageHeader}`}
          onPointerDown={isDragOverlay ? undefined : activatePassage}
        >
          <div className={`flex items-start justify-between ${QUESTION_BUILDER_GAPS.passageHeaderRow}`}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-[500] leading-[14px] tracking-[-0.02em] text-[#747775]">
                  Instruction language
                </p>
                <div className="flex items-center rounded-[6px] border border-[#E5E5E5] bg-white p-0.5">
                  {(
                    [
                      { id: "bn", label: "Bangla" },
                      { id: "en", label: "English" },
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
                        className={`rounded-[4px] px-2.5 py-1 text-[12px] font-[500] leading-[14px] tracking-[-0.02em] transition-colors ${
                          isSelected ? "bg-[#49734F] text-white" : "bg-transparent text-[#232A25] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="max-w-[480px] text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
                {instructionLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dispatch(deleteQuestion({ subjectId, questionId: passage.id }))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors hover:bg-[#D24B44] hover:text-white"
              aria-label="Delete passage block"
            >
              <TrashIcon />
            </button>
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
            placeholder="Write your passage here..."
            autoFocus={shouldAutoFocusPassage}
            minHeightClassName="min-h-[96px]"
            className="border-[#E5E5E5] bg-white"
          />
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
          className="flex-shrink-0 cursor-grab touch-none text-[#747775] transition-colors hover:text-[#232A25] active:cursor-grabbing"
          aria-label="Drag passage block"
        >
          <DragHandleIcon />
        </button>
      </div>
    </div>
  );
}

export default memo(PassageQuestionBlock);
