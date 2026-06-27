import Image from "next/image";
import TrashIcon from "@/component/svg/TrashIcon";
import UploadImageIconSVG from "@/component/svg/UploadImageIconSVG";
import MicrophoneIconSVG from "@/component/svg/MicrophoneIconSVG";
import { useToast } from "@/component/Toast/ToastContext";
import { clearPendingFocusQuestionId, updateQuestionImage, updateQuestionText } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useSpeechRecognition, { type SpeechRecognitionLanguage } from "@/hooks/useSpeechRecognition";
import Tooltip from "@/Ui/Tooltip";
import Link from "next/link";
import { QUESTION_BUILDER_GAPS, readImageFileAsDataUrl, resizeTextarea } from "./shared";

// Configurable speech language. Future: en-US | en-GB | bn-BD (and can be promoted to a prop).
const SPEECH_LANGUAGE: SpeechRecognitionLanguage = "en-US";

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

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

  // Keep the latest text in a ref so dictated speech always appends to the current value.
  const questionTextRef = useRef(questionText);
  useEffect(() => {
    questionTextRef.current = questionText;
  }, [questionText]);

  const handleSpeechResult = useCallback(
    (spokenText: string) => {
      const existing = questionTextRef.current ?? "";
      const needsSpace = existing.length > 0 && !/\s$/.test(existing);
      const nextText = `${existing}${needsSpace ? " " : ""}${spokenText}`;
      dispatch(updateQuestionText({ subjectId, questionId, text: nextText, parentPassageId }));
    },
    [dispatch, parentPassageId, questionId, subjectId],
  );

  const { isSupported, isListening, interimTranscript, startListening, stopListening } = useSpeechRecognition({
    lang: SPEECH_LANGUAGE,
    onResult: handleSpeechResult,
    onError: (message) => triggerToast({ description: message, type: "error" }),
  });

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  useEffect(() => {
    if (!isListening) {
      setRecordingSeconds(0);
      return;
    }
    const intervalId = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(intervalId);
  }, [isListening]);

  const handleMicClick = useCallback(() => {
    if (!isSupported) {
      triggerToast({
        description: "Speech recognition is not supported in your browser.",
        type: "error",
      });
      return;
    }
    activateCard();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [activateCard, isListening, isSupported, startListening, stopListening, triggerToast]);

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
            {isListening ? (
              <div className="flex items-center gap-2 rounded-[8px] bg-[#D24B4410] px-3 py-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D24B44] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#D24B44]" />
                </span>
                <span className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#D24B44]">
                  Recording {formatDuration(recordingSeconds)}
                </span>
                {interimTranscript ? (
                  <span className="min-w-0 flex-1 truncate text-[14px] font-[400] italic leading-[16px] tracking-[-0.02em] text-[#747775]">
                    {interimTranscript}
                  </span>
                ) : null}
              </div>
            ) : null}
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
          <Tooltip content={!isSupported ? "Speech recognition is not supported in your browser." : null}>
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!isSupported}
              title={isListening ? "Stop recording" : "Speak the question"}
              aria-label={isListening ? "Stop recording" : "Speak the question"}
              aria-pressed={isListening}
              className={`flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors duration-150 ${
                isListening
                  ? "animate-pulse bg-[#D24B44] text-white"
                  : "text-[#49734F] hover:bg-[#EFF0F3]"
              } ${!isSupported ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <MicrophoneIconSVG />
            </button>
          </Tooltip>
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
