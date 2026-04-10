import Image from "next/image";
import CopyIconSVG from "@/component/svg/CopyIconSVG";
import DragHandleIcon from "@/component/svg/DragHandleIcon";
import ShuffleIcon from "@/component/svg/ShuffleIcon";
import TrashIcon from "@/component/svg/TrashIcon";
import UploadImageIconSVG from "@/component/svg/UploadImageIconSVG";
import { useToast } from "@/component/Toast/ToastContext";
import {
  addOption,
  clearPendingFocusOption,
  clearPendingFocusQuestionId,
  deleteQuestion,
  duplicateQuestion,
  removeOption,
  selectCorrectOption,
  setActiveQuestionId,
  shuffleOptions,
  updateOptionImage,
  updateOptionText,
  updateQuestionPoints,
  updateQuestionImage,
  updateQuestionText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";
import { memo, useCallback, useEffect, useRef } from "react";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const resizeTextarea = (element: HTMLTextAreaElement | null) => {
  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

const readImageFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read image file."));
    };

    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });

const QuestionCard = memo(
  ({
    scrollContainerRef,
    subjectId,
    sectionId,
    sectionType,
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
  }: QuestionCardProps) => {
    const dispatch = useAppDispatch();
    const { triggerToast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);
    const optionInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    const optionImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const addOptionButtonRef = useRef<HTMLButtonElement>(null);
    const addOptionImageInputRef = useRef<HTMLInputElement>(null);
    const questionInputRef = useRef<HTMLTextAreaElement>(null);
    const questionImageInputRef = useRef<HTMLInputElement>(null);
    const validationErrors = getQuestionValidationErrors(question, sectionType);

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

    const handleQuestionImageChange = useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file || !validateImageFile(file)) {
          return;
        }

        try {
          const image = await readImageFileAsDataUrl(file);
          dispatch(updateQuestionImage({ subjectId, sectionId, questionId: question.id, image }));
          activateCard();
        } catch {
          triggerToast({
            description: "Unable to upload image right now.",
            type: "error",
          });
        }
      },
      [activateCard, dispatch, question.id, sectionId, subjectId, triggerToast, validateImageFile],
    );

    const handleOptionImageChange = useCallback(
      async (optionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file || !validateImageFile(file)) {
          return;
        }

        try {
          const image = await readImageFileAsDataUrl(file);
          dispatch(updateOptionImage({ subjectId, sectionId, questionId: question.id, optionId, image }));
          activateCard();
        } catch {
          triggerToast({
            description: "Unable to upload image right now.",
            type: "error",
          });
        }
      },
      [activateCard, dispatch, question.id, sectionId, subjectId, triggerToast, validateImageFile],
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

    const handleAddImageOptionChange = useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file || !validateImageFile(file)) {
          return;
        }

        try {
          const image = await readImageFileAsDataUrl(file);
          dispatch(addOption({ subjectId, sectionId, questionId: question.id, image }));
          activateCard();
          if (addOptionButtonRef.current && scrollContainerRef.current) {
            const buttonRect = addOptionButtonRef.current.getBoundingClientRect();
            const scrollRect = scrollContainerRef.current.getBoundingClientRect();
            if (scrollRect.bottom - buttonRect.bottom <= 30) {
              setTimeout(() => {
                scrollContainerRef.current?.scrollTo({
                  top: scrollContainerRef.current.scrollHeight,
                  behavior: "smooth",
                });
              }, 0);
            }
          }
        } catch {
          triggerToast({
            description: "Unable to upload image right now.",
            type: "error",
          });
        }
      },
      [activateCard, dispatch, question.id, scrollContainerRef, sectionId, subjectId, triggerToast, validateImageFile],
    );

    const handleAddOptionWithScroll = useCallback(() => {
      dispatch(addOption({ subjectId, sectionId, questionId: question.id }));

      if (addOptionButtonRef.current && scrollContainerRef.current) {
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
      }
    }, [dispatch, question.id, scrollContainerRef, sectionId, subjectId]);

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
    }, [dispatch, pendingFocusOptionId, question.options, scrollElementIntoView]);

    useEffect(() => {
      if (shouldAutoFocus && questionInputRef.current) {
        questionInputRef.current.focus();
        resizeTextarea(questionInputRef.current);
        requestAnimationFrame(() => {
          scrollElementIntoView(cardRef.current);
        });
        dispatch(clearPendingFocusQuestionId());
      }
    }, [dispatch, scrollElementIntoView, shouldAutoFocus]);

    useEffect(() => {
      resizeTextarea(questionInputRef.current);
    }, [question.text]);

    useEffect(() => {
      Object.values(optionInputRefs.current).forEach((element) => {
        resizeTextarea(element);
      });
    }, [question.options]);

    return (
      <div
        ref={(node) => {
          cardRef.current = node;
          setCardRef(node);
        }}
        style={isDragOverlay ? overlayStyle : cardStyle}
        onPointerDownCapture={isDragOverlay ? undefined : activateCard}
        onFocusCapture={isDragOverlay ? undefined : activateCard}
        className={`flex items-center gap-2 w-full  ${
          isDragOverlay ? "bg-[#FDF3E5] fixed z-50 pointer-events-none shadow-[0px_24px_60px_rgba(15,26,18,0.18)]" : ""
        } ${isDragging ? "opacity-0" : "opacity-100"}`}
      >
        <div
          className={`w-full flex flex-col gap-6 rounded-[8px] border p-5 
            transition-[opacity,transform,box-shadow] duration-200 
            ${isActive ? "border-transparent bg-[#FDF3E5]" : "border-[#E5E5E5] bg-white"}
          `}
        >
          <div className="flex items-start justify-between gap-8">
            <div className="flex w-full items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 gap-2">
                <span className="pt-[2px] text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
                  {questionNumber}.
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <textarea
                    ref={questionInputRef}
                    value={question.text}
                    onChange={(e) =>
                      dispatch(
                        updateQuestionText({
                          subjectId,
                          sectionId,
                          questionId: question.id,
                          text: e.target.value,
                        }),
                      )
                    }
                    onFocus={(event) => {
                      resizeTextarea(event.currentTarget);
                      activateCard();
                    }}
                    placeholder="Write your question here.."
                    rows={1}
                    className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12] outline-none placeholder:text-[#747775]"
                  />
                  {question.image ? (
                    <div className="flex items-center gap-2">
                      <div className="relative h-40 w-full max-w-[320px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white">
                        <Image
                          src={question.image}
                          alt={`Question ${questionNumber} image`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title={question.image ? "Replace question image" : "Upload question image"}
                          onClick={() => questionImageInputRef.current?.click()}
                          className=""
                          aria-label={question.image ? "Replace question image" : "Upload question image"}
                        >
                          <UploadImageIconSVG />
                        </button>
                        {question.image ? (
                          <button
                            type="button"
                            title="Remove question image"
                            onClick={() =>
                              dispatch(
                                updateQuestionImage({ subjectId, sectionId, questionId: question.id, image: null }),
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150"
                            aria-label="Remove question image"
                          >
                            <TrashIcon />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <input
                  ref={questionImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQuestionImageChange}
                  className="hidden"
                />
                {!question.image && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={question.image ? "Replace question image" : "Upload question image"}
                      onClick={() => questionImageInputRef.current?.click()}
                      className=""
                      aria-label={question.image ? "Replace question image" : "Upload question image"}
                    >
                      <UploadImageIconSVG />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {sectionType === "objective" && (
            <div className="flex flex-col gap-2">
              {(question.options ?? []).map((option) => {
                const isSelected = question.correctOptionId === option.id;

                return (
                  <div
                    key={option.id}
                    className="group flex items-center gap-2 rounded-[2px] px-0 py-1 hover:bg-[#ED86001A]"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={isSelected}
                      onChange={() =>
                        dispatch(
                          selectCorrectOption({
                            subjectId,
                            sectionId,
                            questionId: question.id,
                            optionId: option.id,
                          }),
                        )
                      }
                      className="mt-1 h-4 w-4 border-[#232A25] text-[#49734F] focus:ring-0"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      {!option.image && (
                        <textarea
                          ref={(element) => {
                            optionInputRefs.current[option.id] = element;
                            resizeTextarea(element);
                          }}
                          value={option.text}
                          onChange={(e) => {
                            resizeTextarea(e.currentTarget);
                            dispatch(
                              updateOptionText({
                                subjectId,
                                sectionId,
                                questionId: question.id,
                                optionId: option.id,
                                text: e.target.value,
                              }),
                            );
                          }}
                          onFocus={activateCard}
                          placeholder="Option"
                          rows={1}
                          className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25] outline-none placeholder:text-[#747775]"
                        />
                      )}
                      {option.image ? (
                        <div className="flex items-center gap-2">
                          <div className="relative h-32 w-full max-w-[240px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white">
                            <Image
                              src={option.image}
                              alt={`Option image for question ${questionNumber}`}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title={option.image ? "Replace option image" : "Upload option image"}
                              onClick={() => optionImageInputRefs.current[option.id]?.click()}
                              className=""
                              aria-label={option.image ? "Replace option image" : "Upload option image"}
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
                                    sectionId,
                                    questionId: question.id,
                                    optionId: option.id,
                                    image: null,
                                  }),
                                )
                              }
                              className="flex items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150"
                              aria-label="Remove option image"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <input
                        ref={(element) => {
                          optionImageInputRefs.current[option.id] = element;
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          void handleOptionImageChange(option.id, event);
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            dispatch(
                              removeOption({
                                subjectId,
                                sectionId,
                                questionId: question.id,
                                optionId: option.id,
                              }),
                            )
                          }
                          className="flex items-center justify-center rounded-[8px] text-[#D24B44] opacity-0 transition-all duration-150 group-hover:opacity-100"
                          aria-label="Delete option"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex w-full gap-2 items-center hover:bg-[#ED86001A]">
                <button
                  ref={addOptionButtonRef}
                  type="button"
                  onClick={handleAddOptionWithScroll}
                  className="flex w-full items-center gap-2 py-1 text-left text-[16px] font-[400] leading-4 tracking-[-0.02em] text-[rgba(116,119,117,0.5)]"
                >
                  <span className="h-4 w-4 rounded-full border border-[rgba(116,119,117,0.5)]" />
                  <span>Click to add a new option</span>
                </button>
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
                  className="flex shrink-0 items-center justify-center rounded-[8px] text-[#747775] transition-colors duration-150 hover:text-[#49734F]"
                  aria-label="Add new option with image"
                >
                  <UploadImageIconSVG />
                </button>
              </div>
            </div>
          )}

          {question.showValidation && validationErrors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[8px] border border-[#F3C7C4] bg-[#FFF4F3] px-4 py-3">
              {validationErrors.map((error) => (
                <p key={error} className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#D24B44]">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">Points</p>
              <div className="flex justify-between items-center bg-white border border-[#E5E5E5]">
                <input
                  type="text"
                  inputMode="numeric"
                  value={question.points || ""}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "+" || (e.shiftKey && e.key === "=")) {
                      e.preventDefault();

                      dispatch(
                        updateQuestionPoints({
                          subjectId,
                          sectionId,
                          questionId: question.id,
                          points: question.points + 1,
                        }),
                      );
                    } else if (
                      (e.key === "ArrowDown" || e.key === "-" || (e.shiftKey && e.key === "_")) &&
                      question.points > 0
                    ) {
                      e.preventDefault();

                      dispatch(
                        updateQuestionPoints({
                          subjectId,
                          sectionId,
                          questionId: question.id,
                          points: question.points - 1,
                        }),
                      );
                    }
                  }}
                  onChange={(e) => {
                    dispatch(
                      updateQuestionPoints({
                        subjectId,
                        sectionId,
                        questionId: question.id,
                        points: +e.target.value,
                      }),
                    );
                  }}
                  className="h-8 w-12 rounded-[2px] bg-white px-2 text-[14px] leading-4 tracking-[-0.02em] text-[#232A25] outline-none"
                />
                <div className="flex-col">
                  <button
                    onClick={() =>
                      dispatch(
                        updateQuestionPoints({
                          subjectId,
                          sectionId,
                          questionId: question.id,
                          points: question.points + 1,
                        }),
                      )
                    }
                    className="h-4 w-4 border-l border-b-[.5px] border-[#E5E5E5] flex justify-center items-center"
                  >
                    <svg width="7" height="4" viewBox="0 0 7 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.33333 -0.000325203L6.66667 3.33301H0L3.33333 -0.000325203Z" fill="#747775" />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      dispatch(
                        updateQuestionPoints({
                          subjectId,
                          sectionId,
                          questionId: question.id,
                          points: question.points - 1,
                        }),
                      )
                    }
                    className="h-4 w-4 border-l border-t-[.5px] border-[#E5E5E5] flex justify-center items-center"
                  >
                    <svg width="7" height="4" viewBox="0 0 7 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.33333 3.33333L6.66667 0H0L3.33333 3.33333Z" fill="#747775" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sectionType === "objective" && (
                <button
                  type="button"
                  onClick={() => dispatch(shuffleOptions({ subjectId, sectionId, questionId: question.id }))}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#232A25] transition-colors duration-150 hover:bg-[#49734F] hover:text-[#FFFFFF]"
                  aria-label="Shuffle options"
                >
                  <ShuffleIcon />
                </button>
              )}
              <button
                type="button"
                onClick={() => dispatch(duplicateQuestion({ subjectId, sectionId, questionId: question.id }))}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#232A25] transition-colors duration-150 hover:bg-[#49734F] hover:text-[#FFFFFF]"
                aria-label="Duplicate question"
              >
                <CopyIconSVG />
              </button>
              <button
                type="button"
                onClick={() => dispatch(deleteQuestion({ subjectId, sectionId, questionId: question.id }))}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150 hover:bg-[#D24B44] hover:text-[#FFFFFF]"
                aria-label="Delete question"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onPointerDown={(event) => onDragHandlePointerDown(subjectId, sectionId, question.id, event)}
          className="flex-shrink-0 cursor-grab touch-none text-[#747775] transition-colors hover:text-[#232A25] active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <DragHandleIcon />
        </button>
      </div>
    );
  },
);

QuestionCard.displayName = "QuestionCard";

export default QuestionCard;
