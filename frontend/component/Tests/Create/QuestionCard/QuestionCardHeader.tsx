import TrashIcon from "@/component/svg/TrashIcon";
import { useTranslations } from "next-intl";
import useQuestionTypeText from "../useQuestionTypeText";
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
import { QUESTION_BUILDER_GAPS } from "./shared";
import { resolveMediaUrl, uploadExamImage } from "@/utils/media/uploadMedia";

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
  const t = useTranslations("createTest.card");
  const typeText = useQuestionTypeText();
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
        console.debug("[media] question image selected", {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        const uploaded = await uploadExamImage(file);
        const previewUrl = resolveMediaUrl(uploaded.url);
        console.debug("[media] question image ready for preview", { previewUrl, key: uploaded.key });
        dispatch(updateQuestionImage({ subjectId, questionId, image: previewUrl, parentPassageId }));
        activateCard();
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
            ?.message;
        console.error("[media] question image upload failed", error);
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

  const handleInlineImageUpload = useCallback(
    async (file: File) => {
      if (!validateImageFile(file)) {
        return null;
      }

      try {
        console.debug("[media] inline image selected", {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        const uploaded = await uploadExamImage(file);
        const previewUrl = resolveMediaUrl(uploaded.url);
        console.debug("[media] inline image ready", { previewUrl, key: uploaded.key });
        return previewUrl;
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
            ?.message;
        console.error("[media] inline image upload failed", error);
        triggerToast({
          description: Array.isArray(message)
            ? message[0]
            : message || t("uploadFailed"),
          type: "error",
        });
        return null;
      }
    },
    [t, triggerToast, validateImageFile],
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
            ? t("pastedFull")
            : t("pastedText"),
        type: "success",
      });
    },
    [activateCard, dispatch, parentPassageId, questionId, subjectId, t, triggerToast],
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
          <span className="pt-[10px] text-body font-medium text-ink">
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
              placeholder={typeText.prompt(fullSubtype.headerPayload)}
              autoFocus={shouldAutoFocus}
              allowImages={canUploadImages}
              onImageFile={canUploadImages ? handleInlineImageUpload : undefined}
              enableStructuredPaste
              onStructuredPaste={handleStructuredPaste}
              minHeightClassName="min-h-[48px]"
              className="border-border bg-surface"
            />
            {questionImage ? (
              <div className={`flex items-center ${QUESTION_BUILDER_GAPS.headerImageActions}`}>
                <div className="relative h-40 w-full max-w-[320px] overflow-hidden rounded-card border border-border bg-surface">
                  {/* Native img: next/Image can hide load failures; we need onError for private S3 proxy debug */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(questionImage)}
                    alt={t("questionImageAlt", { number: questionNumber })}
                    className="h-full w-full object-cover"
                    onLoad={() =>
                      console.debug("[media] question preview loaded", {
                        src: resolveMediaUrl(questionImage),
                      })
                    }
                    onError={(event) => {
                      console.error("[media] question preview failed to load", {
                        src: resolveMediaUrl(questionImage),
                        nativeSrc: (event.target as HTMLImageElement)?.currentSrc,
                      });
                    }}
                  />
                </div>
                <div className={`flex items-center ${QUESTION_BUILDER_GAPS.headerImageActions}`}>
                  <button
                    type="button"
                    title={t("replaceQuestionImage")}
                    onClick={() => questionImageInputRef.current?.click()}
                    aria-label={t("replaceQuestionImage")}
                  >
                    <UploadImageIconSVG />
                  </button>
                  <button
                    type="button"
                    title={t("removeQuestionImage")}
                    onClick={() =>
                      dispatch(updateQuestionImage({ subjectId, questionId, image: null, parentPassageId }))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-input text-danger transition-colors duration-150"
                    aria-label={t("removeQuestionImage")}
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
                      <Link href="/billing" className="underline text-primary">
                        Upgrade
                      </Link>
                    </span>
                  ) : null
                }
              >
                <button
                  type="button"
                  title={t("uploadQuestionImage")}
                  onClick={() => canUploadImages && questionImageInputRef.current?.click()}
                  disabled={!canUploadImages}
                  className={!canUploadImages ? "opacity-50 cursor-not-allowed" : ""}
                  aria-label={t("uploadQuestionImage")}
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
