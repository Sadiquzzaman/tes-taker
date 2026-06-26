import Image from "next/image";
import TrashIcon from "@/component/svg/TrashIcon";
import UploadImageIconSVG from "@/component/svg/UploadImageIconSVG";
import { useToast } from "@/component/Toast/ToastContext";
import { clearPendingFocusQuestionId, updateQuestionImage, updateQuestionText } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import Tooltip from "@/Ui/Tooltip";
import Link from "next/link";
import { QUESTION_BUILDER_GAPS, readImageFileAsDataUrl, resizeTextarea } from "./shared";

function QuestionCardHeader({
  activateCard,
  cardRef,
  parentPassageId,
  questionId,
  questionImage,
  questionNumber,
  questionText,
  scrollElementIntoView,
  shouldAutoFocus,
  subjectId,
  validateImageFile,
  fullSubtype,
}: QuestionCardHeaderProps) {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const { hasFeature } = useEntitlements();
  const canUploadImages = hasFeature("allow_question_images");
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const questionImageInputRef = useRef<HTMLInputElement>(null);

  const handleQuestionImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !validateImageFile(file)) {
        return;
      }

      try {
        const image = await readImageFileAsDataUrl(file);
        dispatch(updateQuestionImage({ subjectId, questionId, image, parentPassageId }));
        activateCard();
      } catch {
        triggerToast({
          description: "Unable to upload image right now.",
          type: "error",
        });
      }
    },
    [activateCard, dispatch, questionId, subjectId, triggerToast, validateImageFile],
  );

  useEffect(() => {
    if (!shouldAutoFocus || !questionInputRef.current) {
      return;
    }

    questionInputRef.current.focus();
    resizeTextarea(questionInputRef.current);
    requestAnimationFrame(() => {
      scrollElementIntoView(cardRef.current);
    });
    dispatch(clearPendingFocusQuestionId());
  }, [cardRef, dispatch, scrollElementIntoView, shouldAutoFocus]);

  useEffect(() => {
    resizeTextarea(questionInputRef.current);
  }, [questionText]);

  return (
    <div className={`flex items-start justify-between ${QUESTION_BUILDER_GAPS.headerOuter}`}>
      <div className={`flex w-full items-start justify-between ${QUESTION_BUILDER_GAPS.headerContent}`}>
        <div className={`flex min-w-0 flex-1 ${QUESTION_BUILDER_GAPS.headerLead}`}>
          <span className="pt-[2px] text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
            {questionNumber}.
          </span>
          <div className={`flex min-w-0 flex-1 flex-col ${QUESTION_BUILDER_GAPS.headerText}`}>
            <textarea
              ref={questionInputRef}
              value={questionText}
              onChange={(event) =>
                dispatch(
                  updateQuestionText({
                    subjectId,
                    questionId,
                    text: event.target.value,
                    parentPassageId,
                  }),
                )
              }
              onFocus={(event) => {
                resizeTextarea(event.currentTarget);
                activateCard();
              }}
              placeholder={fullSubtype.headerPayload}
              rows={1}
              className="min-h-[20px] w-full resize-none overflow-hidden bg-transparent text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12] outline-none placeholder:text-[#747775]"
            />
            {questionImage ? (
              <div className={`flex items-center ${QUESTION_BUILDER_GAPS.headerImageActions}`}>
                <div className="relative h-40 w-full max-w-[320px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white">
                  <Image
                    src={questionImage}
                    alt={`Question ${questionNumber} image`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className={`flex items-center ${QUESTION_BUILDER_GAPS.headerImageActions}`}>
                  <button
                    type="button"
                    title="Replace question image"
                    onClick={() => questionImageInputRef.current?.click()}
                    aria-label="Replace question image"
                  >
                    <UploadImageIconSVG />
                  </button>
                  <button
                    type="button"
                    title="Remove question image"
                    onClick={() =>
                      dispatch(updateQuestionImage({ subjectId, questionId, image: null, parentPassageId }))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[#D24B44] transition-colors duration-150"
                    aria-label="Remove question image"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className={`flex shrink-0 flex-col items-end ${QUESTION_BUILDER_GAPS.headerSide}`}>
          <input
            ref={questionImageInputRef}
            type="file"
            accept="image/*"
            onChange={handleQuestionImageChange}
            className="hidden"
          />
          {!questionImage ? (
            <div className={`flex items-center ${QUESTION_BUILDER_GAPS.headerImageActions}`}>
              <Tooltip
                content={
                  !canUploadImages ? (
                    <span>
                      Not in your plan. Please upgrade.{" "}
                      <Link href="/account" className="underline text-[#49734F]">
                        Upgrade
                      </Link>
                    </span>
                  ) : null
                }
              >
                <button
                  type="button"
                  title="Upload question image"
                  onClick={() => canUploadImages && questionImageInputRef.current?.click()}
                  disabled={!canUploadImages}
                  className={!canUploadImages ? "opacity-50 cursor-not-allowed" : ""}
                  aria-label="Upload question image"
                >
                  <UploadImageIconSVG />
                </button>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default memo(QuestionCardHeader);
