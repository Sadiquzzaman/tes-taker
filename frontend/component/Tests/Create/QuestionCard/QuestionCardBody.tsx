import Image from "next/image";
import PlusIcon from "@/component/svg/PlusIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import UploadImageIconSVG from "@/component/svg/UploadImageIconSVG";
import { useToast } from "@/component/Toast/ToastContext";
import {
  addOption,
  clearPendingFocusOption,
  removeOption,
  selectCorrectOption,
  updateOptionImage,
  updateOptionText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { QUESTION_BUILDER_GAPS, readImageFileAsDataUrl, resizeTextarea } from "./shared";

function QuestionCardBody({
  activateCard,
  canAddMoreOptions,
  canAddOptions,
  canEditOptionImage,
  canEditOptionText,
  canRemoveOptions,
  maxOptions,
  options,
  pendingFocusOptionId,
  parentPassageId,
  questionId,
  questionNumber,
  scrollContainerRef,
  scrollElementIntoView,
  selectedOptionIds,
  subjectId,
  usesMultipleAnswers,
  validateImageFile,
}: QuestionCardBodyProps) {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const optionInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const optionImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addOptionButtonRef = useRef<HTMLButtonElement>(null);
  const addOptionImageInputRef = useRef<HTMLInputElement>(null);

  const scrollToOptionListEndIfNeeded = useCallback(() => {
    if (!addOptionButtonRef.current || !scrollContainerRef.current) {
      return;
    }

    const buttonRect = addOptionButtonRef.current.getBoundingClientRect();
    const scrollRect = scrollContainerRef.current.getBoundingClientRect();
    const distanceFromBottom = scrollRect.bottom - buttonRect.bottom;

    if (distanceFromBottom <= 30) {
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 0);
    }
  }, [scrollContainerRef]);

  const handleOptionImageChange = useCallback(
    async (optionId: string, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !validateImageFile(file)) {
        return;
      }

      try {
        const image = await readImageFileAsDataUrl(file);
        dispatch(updateOptionImage({ subjectId, questionId, optionId, image, parentPassageId }));
        activateCard();
      } catch {
        triggerToast({
          description: "Unable to upload image right now.",
          type: "error",
        });
      }
    },
    [activateCard, dispatch, parentPassageId, questionId, subjectId, triggerToast, validateImageFile],
  );

  const handleAddImageOptionChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !validateImageFile(file)) {
        return;
      }

      try {
        const image = await readImageFileAsDataUrl(file);
        dispatch(addOption({ subjectId, questionId, image, parentPassageId }));
        activateCard();
        scrollToOptionListEndIfNeeded();
      } catch {
        triggerToast({
          description: "Unable to upload image right now.",
          type: "error",
        });
      }
    },
    [
      activateCard,
      dispatch,
      parentPassageId,
      questionId,
      scrollToOptionListEndIfNeeded,
      subjectId,
      triggerToast,
      validateImageFile,
    ],
  );

  const handleAddOptionWithScroll = useCallback(() => {
    dispatch(addOption({ subjectId, questionId, parentPassageId }));
    scrollToOptionListEndIfNeeded();
  }, [dispatch, parentPassageId, questionId, scrollToOptionListEndIfNeeded, subjectId]);

  useEffect(() => {
    if (!pendingFocusOptionId) {
      return;
    }

    const input = optionInputRefs.current[pendingFocusOptionId];

    if (input) {
      input.focus();
      requestAnimationFrame(() => {
        scrollElementIntoView(input);
      });
      dispatch(clearPendingFocusOption());
    }
  }, [dispatch, options, pendingFocusOptionId, scrollElementIntoView]);

  useEffect(() => {
    Object.values(optionInputRefs.current).forEach((element) => {
      resizeTextarea(element);
    });
  }, [options]);

  return (
    <div className={`flex flex-col ${QUESTION_BUILDER_GAPS.bodyStack}`}>
      {options.map((option) => {
        const isSelected = usesMultipleAnswers
          ? selectedOptionIds.includes(option.id)
          : selectedOptionIds[0] === option.id;

        return (
          <div
            key={option.id}
            className={`group flex items-center ${QUESTION_BUILDER_GAPS.optionRow} rounded-[2px] px-0 py-1 hover:bg-[#ED86001A]`}
          >
            <input
              type={usesMultipleAnswers ? "checkbox" : "radio"}
              name={usesMultipleAnswers ? option.id : `question-${questionId}`}
              checked={isSelected}
              onChange={() =>
                dispatch(
                  selectCorrectOption({
                    subjectId,
                    questionId,
                    optionId: option.id,
                    parentPassageId,
                  }),
                )
              }
              className="mt-1 h-4 w-4 border-[#232A25] text-[#49734F] focus:ring-0"
            />
            <div className={`flex min-w-0 flex-1 flex-col ${QUESTION_BUILDER_GAPS.optionContent}`}>
              {canEditOptionText && !option.image ? (
                <textarea
                  ref={(element) => {
                    if (!element) {
                      delete optionInputRefs.current[option.id];
                      return;
                    }

                    optionInputRefs.current[option.id] = element;
                    resizeTextarea(element);
                  }}
                  value={option.text}
                  onChange={(event) => {
                    resizeTextarea(event.currentTarget);
                    dispatch(
                      updateOptionText({
                        subjectId,
                        questionId,
                        optionId: option.id,
                        text: event.target.value,
                        parentPassageId,
                      }),
                    );
                  }}
                  onFocus={activateCard}
                  placeholder="Option"
                  rows={1}
                  className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25] outline-none placeholder:text-[#747775]"
                />
              ) : (
                <p className="text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">{option.text}</p>
              )}
              {option.image ? (
                <div className={`flex items-center ${QUESTION_BUILDER_GAPS.optionImageActions}`}>
                  <div className="relative h-32 w-full max-w-[240px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white">
                    <Image
                      src={option.image}
                      alt={`Option image for question ${questionNumber}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  {canEditOptionImage ? (
                    <div className={`flex items-center ${QUESTION_BUILDER_GAPS.optionActionButtons}`}>
                      <button
                        type="button"
                        title="Replace option image"
                        onClick={() => optionImageInputRefs.current[option.id]?.click()}
                        aria-label="Replace option image"
                      >
                        <UploadImageIconSVG />
                      </button>
                      <button
                        type="button"
                        title="Remove option image"
                        onClick={() =>
                          dispatch(
                            updateOptionImage({
                              subjectId,
                              questionId,
                              optionId: option.id,
                              image: null,
                              parentPassageId,
                            }),
                          )
                        }
                        className="flex items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150"
                        aria-label="Remove option image"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className={`flex shrink-0 items-start ${QUESTION_BUILDER_GAPS.optionSide}`}>
              {canEditOptionImage ? (
                <input
                  ref={(element) => {
                    if (!element) {
                      delete optionImageInputRefs.current[option.id];
                      return;
                    }

                    optionImageInputRefs.current[option.id] = element;
                  }}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handleOptionImageChange(option.id, event);
                  }}
                  className="hidden"
                />
              ) : null}
              <div className={`flex items-center ${QUESTION_BUILDER_GAPS.optionActionButtons}`}>
                {canRemoveOptions ? (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch(
                        removeOption({
                          subjectId,
                          questionId,
                          optionId: option.id,
                          parentPassageId,
                        }),
                      )
                    }
                    className="flex items-center justify-center rounded-[8px] text-[#D24B44] opacity-0 transition-all duration-150 group-hover:opacity-100"
                    aria-label="Delete option"
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      {canAddOptions ? (
        <div
          className={`flex w-full items-center ${QUESTION_BUILDER_GAPS.addOptionRow} ${
            canAddMoreOptions ? "hover:bg-[#ED86001A]" : ""
          }`}
        >
          <button
            ref={addOptionButtonRef}
            type="button"
            onClick={handleAddOptionWithScroll}
            disabled={!canAddMoreOptions}
            className={`flex w-full items-center ${QUESTION_BUILDER_GAPS.addOptionRow} py-1 text-left text-[16px] font-[400] leading-4 tracking-[-0.02em] text-[rgba(116,119,117,0.5)] ${
              canAddMoreOptions ? "" : "cursor-default"
            }`}
          >
            {canAddMoreOptions ? <PlusIcon width={16} /> : null}
            <span>{canAddMoreOptions ? "Click to add a new option" : `Maximum ${maxOptions} options added`}</span>
          </button>
          {canEditOptionImage && canAddMoreOptions ? (
            <>
              <input
                ref={addOptionImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleAddImageOptionChange}
                className="hidden"
              />
              <button
                type="button"
                title="Add new option with image"
                onClick={() => addOptionImageInputRef.current?.click()}
                disabled={!canAddMoreOptions}
                className="flex shrink-0 items-center justify-center rounded-[8px] text-[#747775] transition-colors duration-150 hover:text-[#49734F] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[#747775]"
                aria-label="Add new option with image"
              >
                <UploadImageIconSVG />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default memo(QuestionCardBody);
