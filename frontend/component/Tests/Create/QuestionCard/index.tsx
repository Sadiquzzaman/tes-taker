import DragHandleIcon from "@/component/svg/DragHandleIcon";
import { useToast } from "@/component/Toast/ToastContext";
import { setActiveQuestionId } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import {
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  getCreateTestQuestionAnswerInputPlaceholder,
  getCreateTestQuestionSubtype,
  isCreateTestObjectiveCategory,
} from "@/utils/createTestOptions";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";
import { memo, useCallback, useRef } from "react";
import QuestionCardBody from "./QuestionCardBody";
import QuestionCardFooter from "./QuestionCardFooter";
import QuestionCardHeader from "./QuestionCardHeader";
import QuestionCardInstruction from "./QuestionCardInstruction";
import QuestionCardMatchingBody from "./QuestionCardMatchingBody";
import QuestionCardMatchingHint from "./QuestionCardMatchingHint";
import QuestionCardTextAnswer from "./QuestionCardTextAnswer";
import QuestionCardValidation from "./QuestionCardValidation";
import { MAX_IMAGE_SIZE_BYTES } from "./shared";

function QuestionCard({
  scrollContainerRef,
  subjectId,
  setCardRef,
  question,
  questionNumber,
  isActive,
  shouldAutoFocus,
  pendingFocusOptionId,
  isDragging,
  isDragOverlay = false,
  cardStyle,
  overlayStyle,
  onDragHandlePointerDown,
}: QuestionCardProps) {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const fullSubtype = getCreateTestQuestionSubtype(question.type, question.subType);
  const optionRules = fullSubtype?.optionRules ?? null;
  const answerMode = fullSubtype?.answerMode ?? "none";
  const answerInputMode = fullSubtype?.answerInputMode ?? "none";
  const isMatchingOrdering =
    isCreateTestObjectiveCategory(question.type) &&
    question.subType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID;
  const validationErrors = getQuestionValidationErrors(question);
  const matchingOptions = question.matchingOptions ?? { left: [], right: [] };
  const optionCount = isMatchingOrdering ? matchingOptions.left.length : (question.options?.length ?? 0);
  const maxOptions = optionRules?.maxOptions ?? 0;
  const hasOptionEditor = Boolean(optionRules) && !isMatchingOrdering;
  const hasMatchingOptionEditor = Boolean(optionRules) && isMatchingOrdering;
  const hasTextAnswerEditor = answerInputMode === "correct-answer";
  const showAlternativeAnswerInput = Boolean(fullSubtype?.supportsAlternativeAnswers);
  const answerInputPlaceholder = getCreateTestQuestionAnswerInputPlaceholder(question.type, question.subType);
  const answerValues = question.answer?.value ?? [];
  const usesMultipleAnswers = answerMode === "multiple";
  const canAddOptions = Boolean(optionRules?.canAddOptions);
  const canEditOptionText = Boolean(optionRules?.canEditOptionText);
  const canEditOptionImage = Boolean(optionRules?.canEditOptionImage);
  const canRemoveOptions = Boolean(optionRules?.canRemoveOptions);
  const canShuffleOptions = Boolean(optionRules?.canShuffleOptions);
  const canAddMoreOptions = Boolean(optionRules?.canAddOptions && optionCount < maxOptions);

  const activateCard = useCallback(() => {
    dispatch(setActiveQuestionId(question.id));
  }, [dispatch, question.id]);

  const validateImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        triggerToast({
          description: "Please select a valid image file.",
          type: "error",
        });
        return false;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        triggerToast({
          description: "Image size must be 5 MB or less.",
          type: "error",
        });
        return false;
      }

      return true;
    },
    [triggerToast],
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

  if (!fullSubtype) {
    return null;
  }

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
        setCardRef(node);
      }}
      style={isDragOverlay ? overlayStyle : cardStyle}
      onPointerDownCapture={isDragOverlay ? undefined : activateCard}
      onFocusCapture={isDragOverlay ? undefined : activateCard}
      className={`flex w-full items-center gap-2 ${
        isDragOverlay ? "fixed z-50 bg-[#FDF3E5] pointer-events-none shadow-[0px_24px_60px_rgba(15,26,18,0.18)]" : ""
      } ${isDragging ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className={`w-full flex flex-col gap-6 rounded-[8px] border p-5 transition-[opacity,transform,box-shadow] duration-200 ${
          isActive ? "border-transparent bg-[#FDF3E5]" : "border-[#E5E5E5] bg-white"
        }`}
      >
        <QuestionCardHeader
          activateCard={activateCard}
          cardRef={cardRef}
          fullSubtype={fullSubtype}
          questionId={question.id}
          questionImage={question.image}
          questionNumber={questionNumber}
          questionText={question.text}
          scrollElementIntoView={scrollElementIntoView}
          shouldAutoFocus={shouldAutoFocus}
          subjectId={subjectId}
          validateImageFile={validateImageFile}
        />

        {hasOptionEditor ? (
          <QuestionCardBody
            activateCard={activateCard}
            canAddMoreOptions={canAddMoreOptions}
            canAddOptions={canAddOptions}
            canEditOptionImage={canEditOptionImage}
            canEditOptionText={canEditOptionText}
            canRemoveOptions={canRemoveOptions}
            maxOptions={maxOptions}
            options={question.options ?? []}
            pendingFocusOptionId={pendingFocusOptionId}
            questionId={question.id}
            questionNumber={questionNumber}
            scrollContainerRef={scrollContainerRef}
            scrollElementIntoView={scrollElementIntoView}
            selectedOptionIds={question.answer?.type === "optionId" ? answerValues : []}
            subjectId={subjectId}
            usesMultipleAnswers={usesMultipleAnswers}
            validateImageFile={validateImageFile}
          />
        ) : null}

        {hasMatchingOptionEditor ? (
          <QuestionCardMatchingBody
            activateCard={activateCard}
            canAddMorePairs={canAddMoreOptions}
            leftOptions={matchingOptions.left}
            maxPairs={maxOptions}
            pendingFocusOptionId={pendingFocusOptionId}
            questionId={question.id}
            rightOptions={matchingOptions.right}
            scrollContainerRef={scrollContainerRef}
            scrollElementIntoView={scrollElementIntoView}
            subjectId={subjectId}
          />
        ) : null}

        {hasTextAnswerEditor ? (
          <QuestionCardTextAnswer
            answerValues={question.answer?.type === "text" ? answerValues : []}
            activateCard={activateCard}
            placeholder={answerInputPlaceholder}
            questionId={question.id}
            showAlternativeAnswerInput={showAlternativeAnswerInput}
            subjectId={subjectId}
          />
        ) : null}

        <QuestionCardValidation showValidation={question.showValidation} validationErrors={validationErrors} />

        {isMatchingOrdering ? <QuestionCardMatchingHint /> : null}

        <QuestionCardFooter
          canShuffleOptions={canShuffleOptions}
          points={question.points}
          questionSubType={question.subType}
          questionId={question.id}
          questionType={question.type}
          subjectId={subjectId}
        />

        <QuestionCardInstruction
          instruction={question.instruction ?? ""}
          questionId={question.id}
          subjectId={subjectId}
        />
      </div>
      <button
        type="button"
        onPointerDown={(event) => onDragHandlePointerDown(subjectId, question.id, event)}
        className="flex-shrink-0 cursor-grab touch-none text-[#747775] transition-colors hover:text-[#232A25] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <DragHandleIcon />
      </button>
    </div>
  );
}

export default memo(QuestionCard);
