import PlusIcon from "@/component/svg/PlusIcon";
import { useTranslations } from "next-intl";
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
import { QUESTION_BUILDER_GAPS, resizeTextarea } from "./shared";
import { resolveMediaUrl, uploadExamImage } from "@/utils/media/uploadMedia";

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
  const t = useTranslations("createTest.card");
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
        console.debug("[media] option image selected", {
          optionId,
          name: file.name,
          type: file.type,
          size: file.size,
        });
        const uploaded = await uploadExamImage(file);
        const previewUrl = resolveMediaUrl(uploaded.url);
        console.debug("[media] option image ready for preview", { optionId, previewUrl, key: uploaded.key });
        dispatch(updateOptionImage({ subjectId, questionId, optionId, image: previewUrl, parentPassageId }));
        activateCard();
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
            ?.message;
        console.error("[media] option image upload failed", error);
        triggerToast({
          description: Array.isArray(message)
            ? message[0]
            : message || t("uploadFailed"),
          type: "error",
        });
      }
    },
    [activateCard, dispatch, parentPassageId, questionId, subjectId, t, triggerToast, validateImageFile],
  );

  const handleAddImageOptionChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !validateImageFile(file)) {
        return;
      }

      try {
        console.debug("[media] add-option image selected", {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        const uploaded = await uploadExamImage(file);
        const previewUrl = resolveMediaUrl(uploaded.url);
        console.debug("[media] add-option image ready", { previewUrl, key: uploaded.key });
        dispatch(addOption({ subjectId, questionId, image: previewUrl, parentPassageId }));
        activateCard();
        scrollToOptionListEndIfNeeded();
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
            ?.message;
        console.error("[media] add-option image upload failed", error);
        triggerToast({
          description: Array.isArray(message)
            ? message[0]
            : message || t("uploadFailed"),
          type: "error",
        });
      }
    },
    [activateCard, dispatch, parentPassageId, questionId, scrollToOptionListEndIfNeeded, subjectId, t, triggerToast, validateImageFile],
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
      {options.map((option, optionIndex) => {
        const isSelected = usesMultipleAnswers
          ? selectedOptionIds.includes(option.id)
          : selectedOptionIds[0] === option.id;

        return (
          <div
            key={option.id}
            className={`group flex items-center ${QUESTION_BUILDER_GAPS.optionRow} rounded-sm px-0 py-1 hover:bg-warning-soft`}
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
              className="mt-1 h-4 w-4 border-ink text-primary focus:ring-0"
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
                  placeholder={t("option")}
                  rows={1}
                  className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-body font-normal text-ink outline-none placeholder:text-ink-muted"
                />
              ) : (
                <p className="text-body font-normal text-ink">{option.text}</p>
              )}
              {option.image ? (
                <div className={`flex items-center ${QUESTION_BUILDER_GAPS.optionImageActions}`}>
                  <div className="relative h-32 w-full max-w-[240px] overflow-hidden rounded-card border border-border bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveMediaUrl(option.image)}
                      alt={t("optionImageAlt", { number: questionNumber })}
                      className="h-full w-full object-cover"
                      onLoad={() =>
                        console.debug("[media] option preview loaded", {
                          src: resolveMediaUrl(option.image || ""),
                        })
                      }
                      onError={() =>
                        console.error("[media] option preview failed to load", {
                          src: resolveMediaUrl(option.image || ""),
                        })
                      }
                    />
                  </div>
                  {canEditOptionImage ? (
                    <div className={`flex items-center ${QUESTION_BUILDER_GAPS.optionActionButtons}`}>
                      <button
                        type="button"
                        title={t("replaceOptionImage")}
                        onClick={() => optionImageInputRefs.current[option.id]?.click()}
                        aria-label={t("replaceOptionImage")}
                      >
                        <UploadImageIconSVG />
                      </button>
                      <button
                        type="button"
                        title={t("removeOptionImage")}
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
                        className="flex items-center justify-center rounded-input text-danger transition-colors duration-150"
                        aria-label={t("removeOptionImage")}
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
                    className="flex items-center justify-center rounded-input text-danger opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={t("deleteOption", { number: optionIndex + 1 })}
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
            canAddMoreOptions ? "hover:bg-warning-soft" : ""
          }`}
        >
          <button
            ref={addOptionButtonRef}
            type="button"
            onClick={handleAddOptionWithScroll}
            disabled={!canAddMoreOptions}
            className={`flex w-full items-center ${QUESTION_BUILDER_GAPS.addOptionRow} py-1 text-left text-body font-normal leading-4 text-[rgba(116,119,117,0.5)] ${
              canAddMoreOptions ? "" : "cursor-default"
            }`}
          >
            {canAddMoreOptions ? <PlusIcon width={16} /> : null}
            <span>{canAddMoreOptions ? t("addOption") : t("maxOptions", { max: maxOptions })}</span>
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
                title={t("addOptionImage")}
                onClick={() => addOptionImageInputRef.current?.click()}
                disabled={!canAddMoreOptions}
                className="flex shrink-0 items-center justify-center rounded-input text-ink-muted transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-ink-muted"
                aria-label={t("addOptionImage")}
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
