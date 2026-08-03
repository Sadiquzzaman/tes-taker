import Image from "next/image";
import TrashIcon from "@/component/svg/TrashIcon";
import UploadImageIconSVG from "@/component/svg/UploadImageIconSVG";
import { RichTextEditor } from "@/component/RichTextEditor";
import { useToast } from "@/component/Toast/ToastContext";
import {
  clearPendingFocusQuestionId,
  applyParsedQuestion,
  updateQuestionImage,
  updateQuestionText,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import Tooltip from "@/Ui/Tooltip";
import Link from "next/link";
import type { ParsedPastedQuestion } from "@/utils/exam/parsePastedQuestion";
import { QUESTION_BUILDER_GAPS, readImageFileAsDataUrl } from "./shared";

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
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  const didAutoFocusRef = useRef(false);

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
    [activateCard, dispatch, parentPassageId, questionId, subjectId, triggerToast, validateImageFile],
  );

  const handleInlineImageUpload = useCallback(
    async (file: File) => {
      if (!validateImageFile(file)) {
        return null;
      }

      try {
        return await readImageFileAsDataUrl(file);
      } catch {
        triggerToast({
          description: "Unable to upload image right now.",
          type: "error",
        });
        return null;
      }
    },
    [triggerToast, validateImageFile],
  );

  const handleStructuredPaste = useCallback(
    (parsed: ParsedPastedQuestion) => {
      dispatch(
        applyParsedQuestion({
          subjectId,
          questionId,
          parentPassageId,
          question: parsed.question,
          options: parsed.options,
          correctIndex: parsed.correctIndex,
          explanation: parsed.explanation,
        }),
      );
      activateCard();
      triggerToast({
        description:
          parsed.options.length > 0
            ? "Question, options, and answer were detected from your paste."
            : "Question text was detected from your paste.",
        type: "success",
      });
    },
    [activateCard, dispatch, parentPassageId, questionId, subjectId, triggerToast],
  );

  useEffect(() => {
    if (!shouldAutoFocus || didAutoFocusRef.current) {
      return;
    }

    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      scrollElementIntoView(cardRef.current);
    });
    dispatch(clearPendingFocusQuestionId());
  }, [cardRef, dispatch, scrollElementIntoView, shouldAutoFocus]);

  return (
    <div className={`flex items-start justify-between ${QUESTION_BUILDER_GAPS.headerOuter}`}>
      <div className={`flex w-full items-start justify-between ${QUESTION_BUILDER_GAPS.headerContent}`}>
        <div className={`flex min-w-0 flex-1 ${QUESTION_BUILDER_GAPS.headerLead}`}>
          <span className="pt-[10px] text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
            {questionNumber}.
          </span>
          <div className={`flex min-w-0 flex-1 flex-col ${QUESTION_BUILDER_GAPS.headerText}`}>
            <RichTextEditor
              value={questionText}
              onChange={(html) =>
                dispatch(
                  updateQuestionText({
                    subjectId,
                    questionId,
                    text: html,
                    parentPassageId,
                  }),
                )
              }
              onFocus={activateCard}
              placeholder={fullSubtype.headerPayload}
              autoFocus={shouldAutoFocus}
              allowImages={canUploadImages}
              onImageFile={canUploadImages ? handleInlineImageUpload : undefined}
              enableStructuredPaste
              onStructuredPaste={handleStructuredPaste}
              minHeightClassName="min-h-[48px]"
              className="border-[#E5E5E5] bg-white"
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
        <div className={`flex shrink-0 items-center ${QUESTION_BUILDER_GAPS.headerSide}`}>
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
                      <Link href="/billing" className="underline text-[#49734F]">
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
