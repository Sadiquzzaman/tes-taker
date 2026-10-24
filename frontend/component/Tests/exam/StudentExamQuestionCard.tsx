"use client";

import StudentExamMatchingOrderInput from "@/component/Tests/exam/StudentExamMatchingOrderInput";
import { RichTextContent } from "@/component/RichTextEditor";
import NotmalTextFeild from "@/Ui/NotmalTextFeild";
import { toggleMultiSelectAnswer } from "@/utils/tests/studentExamAnswers";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface StudentExamQuestionCardProps {
  question: StudentExamViewQuestion;
  answerState: ExamAnswerState;
  disabled: boolean;
  isNegativeMarkingEnabled: boolean;
  negativeMarkValue: number;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
  onMatchingChange: (questionId: string, value: string[]) => void;
}

const countWords = (value: string) => (value.trim() ? value.trim().split(/\s+/).length : 0);

const StudentExamSpeakingRecorder = ({
  questionId,
  value,
  disabled,
  timeLimitSeconds,
  onAnswerChange,
}: {
  questionId: string;
  value: string;
  disabled: boolean;
  timeLimitSeconds?: number | null;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
}) => {
  const t = useTranslations("exam");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecording || secondsLeft === null) {
      return;
    }
    if (secondsLeft <= 0) {
      mediaRecorderRef.current?.stop();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((prev) => (prev === null ? null : prev - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [isRecording, secondsLeft]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled) {
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setSecondsLeft(null);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            onAnswerChange(questionId, reader.result);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      if (timeLimitSeconds && timeLimitSeconds > 0) {
        setSecondsLeft(timeLimitSeconds);
      }
    } catch {
      setError(t("micRequiredToRecord"));
    }
  }, [disabled, onAnswerChange, questionId, t, timeLimitSeconds]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            disabled={disabled}
            onClick={startRecording}
            className="rounded-input bg-primary px-4 py-2 text-body-sm font-medium text-ink-inverse disabled:opacity-50"
          >
            {value ? t("reRecord") : t("startRecording")}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-input bg-danger px-4 py-2 text-body-sm font-medium text-ink-inverse"
          >
            {t("stopRecording")}
          </button>
        )}
        {secondsLeft !== null ? (
          <span className="text-body-sm text-ink-muted">{t("recordingTimeLeft", { seconds: secondsLeft })}</span>
        ) : null}
      </div>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {value ? <audio controls src={value} className="w-full" preload="metadata" /> : null}
    </div>
  );
};

const StudentExamQuestionCard = ({
  question,
  answerState,
  disabled,
  isNegativeMarkingEnabled,
  negativeMarkValue,
  onAnswerChange,
  onMatchingChange,
}: StudentExamQuestionCardProps) => {
  const t = useTranslations("exam");
  const answerValue = answerState[question.id];
  const textValue = typeof answerValue === "string" ? answerValue : "";
  const selectedOptionIds = Array.isArray(answerValue) ? answerValue : [];
  const negativeMark =
    isNegativeMarkingEnabled && question.isAutoScored ? Number(((question.points * negativeMarkValue) / 100).toFixed(2)) : null;
  const isWritingTask = question.subType.startsWith("writing-task-");
  const wordCount = useMemo(() => countWords(textValue), [textValue]);
  const wordLimit = question.wordLimit ?? null;

  return (
    <article className="flex w-full flex-col gap-3 rounded-input bg-surface p-4">
      {question.instruction ? (
        <RichTextContent html={question.instruction} className="text-body-sm leading-5 text-primary" />
      ) : null}

      <div className="flex min-w-0 gap-2">
        <span className="w-4 shrink-0 text-center text-body font-medium leading-5 text-ink">
          {question.questionNumber}.
        </span>
        <RichTextContent
          html={question.text}
          className="min-w-0 flex-1 text-body font-medium leading-5 text-ink"
        />
      </div>

      {question.audioUrl ? (
        <audio controls src={question.audioUrl} className="w-full" preload="metadata">
          {t("noAudioSupport")}
        </audio>
      ) : null}

      {question.inputMode === "text" ? (
        <div className="flex flex-col gap-3">
          <NotmalTextFeild
            value={textValue}
            onChange={(event) => onAnswerChange(question.id, event.target.value)}
            placeholder={isWritingTask ? t("writeEssay") : t("writeAnswer")}
            rows={isWritingTask ? 12 : 4}
            maxRows={isWritingTask ? 24 : 6}
            disabled={disabled}
            parentClassName="rounded-input border-border bg-surface px-3 py-[10px]"
            inputClassName="text-body font-normal leading-5 text-ink placeholder:text-ink-muted"
          />
        </div>
      ) : null}

      {question.inputMode === "audio-record" ? (
        <StudentExamSpeakingRecorder
          questionId={question.id}
          value={textValue}
          disabled={disabled}
          timeLimitSeconds={question.timeLimitSeconds}
          onAnswerChange={onAnswerChange}
        />
      ) : null}

      {question.inputMode === "single-select" ? (
        <div className="flex flex-col gap-1">
          {question.options?.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-2 py-1 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name={question.id}
                value={option.id}
                disabled={disabled}
                checked={selectedOptionIds.includes(option.id)}
                onChange={() => onAnswerChange(question.id, [option.id])}
                className="h-4 w-4 border-ink text-primary focus:ring-0"
              />
              <span className="text-body leading-4 text-ink">{option.text}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.inputMode === "multi-select" ? (
        <div className="flex flex-col gap-1">
          {question.options?.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-2 py-1 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                value={option.id}
                disabled={disabled}
                checked={selectedOptionIds.includes(option.id)}
                onChange={() => onAnswerChange(question.id, toggleMultiSelectAnswer(answerValue, option.id))}
                className="h-4 w-4 rounded border-ink text-primary focus:ring-0"
              />
              <span className="text-body leading-4 text-ink">{option.text}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.inputMode === "matching" && question.matchingOptions ? (
        <StudentExamMatchingOrderInput
          answerState={answerState}
          disabled={disabled}
          questionId={question.id}
          matchingOptions={question.matchingOptions}
          onMatchingChange={onMatchingChange}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {question.inputMode === "text" ? (
          <p className="text-body-sm leading-5 text-ink-muted">
            {wordLimit ? t("wordCountLimit", { count: wordCount, limit: wordLimit }) : t("wordCount", { count: wordCount })}
          </p>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 text-body-sm leading-5 text-ink-muted">
          <span>{t("points", { points: question.points })}</span>
          {negativeMark !== null ? <span>|</span> : null}
          {negativeMark !== null ? <span>{t("negativeMarking", { mark: negativeMark })}</span> : null}
        </div>
      </div>
    </article>
  );
};

export default StudentExamQuestionCard;
