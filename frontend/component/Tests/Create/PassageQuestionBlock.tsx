import NotmalTextFeild from "@/Ui/NotmalTextFeild";
import DragHandleIcon from "@/component/svg/DragHandleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import {
  clearPendingFocusQuestionId,
  deleteQuestion,
  setActiveQuestionId,
  updatePassageText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
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
  const passageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const shouldAutoFocusPassage =
    pendingFocusQuestion?.parentPassageId === passage.id && pendingFocusQuestion.questionId === null;
  const passageErrors = passage.showValidation && !passage.passageText.trim() ? ["Add passage text."] : [];

  const activatePassage = useCallback(() => {
    dispatch(
      setActiveQuestionId({
        questionId: null,
        parentPassageId: passage.id,
      }),
    );
  }, [dispatch, passage.id]);

  useEffect(() => {
    if (!shouldAutoFocusPassage || !passageTextareaRef.current) {
      return;
    }

    passageTextareaRef.current.focus();
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
            <p className="max-w-[420px] text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
              Read the passage below and answer the following questions
            </p>
            <button
              type="button"
              onClick={() => dispatch(deleteQuestion({ subjectId, questionId: passage.id }))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors hover:bg-[#D24B44] hover:text-white"
              aria-label="Delete passage block"
            >
              <TrashIcon />
            </button>
          </div>
          <NotmalTextFeild
            value={passage.passageText}
            onChange={(event) =>
              dispatch(
                updatePassageText({
                  subjectId,
                  passageId: passage.id,
                  passageText: event.target.value,
                }),
              )
            }
            setTextareaRef={(element) => {
              passageTextareaRef.current = element;
            }}
            placeholder="Write your passage here..."
            rows={3}
            onFocus={activatePassage}
            parentClassName="min-h-0 rounded-[8px] border-transparent bg-transparent px-0 py-0"
            inputClassName="text-[16px] font-[400] leading-[24px] text-[#232A25] placeholder:text-[#747775]"
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
