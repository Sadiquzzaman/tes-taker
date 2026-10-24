import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import IncorrectFilledIconSVG from "../svg/IncorrectFilledIconSVG";
import GradingAnswerView from "./GradingAnswerView";
import { RichTextContent } from "@/component/RichTextEditor";
import Image from "next/image";
import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";

const GradedQuestionCard = ({ question }: GradingModalGradedQuestionCardProps) => {
  const t = useTranslations("grading.answer");
  const format = useFormat();
  const answerStatus = question.isCorrect === true ? "correct" : question.isCorrect === false ? "incorrect" : null;

  return (
    <div className="flex flex-col gap-6 rounded-input border border-border bg-surface p-5">
      <div className="flex flex-col gap-3">
        {question.instruction ? (
          <RichTextContent
            html={question.instruction}
            className="text-body-sm font-normal text-ink-muted"
          />
        ) : null}
        <div className="flex items-start gap-2 text-ink">
          <span className="shrink-0 text-body font-medium">{format.number(question.questionNumber)}.</span>
          <RichTextContent
            html={question.question}
            className="flex-1 text-body font-medium"
          />
        </div>
      </div>

      {question.imageUrl ? (
        <Image
          src={question.imageUrl}
          alt={t("imageAlt", { number: question.questionNumber })}
          width={0}
          height={0}
          sizes="100vw"
          unoptimized
          className="h-auto max-h-60 w-auto rounded-input object-contain"
        />
      ) : null}

      <GradingAnswerView question={question} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-body-sm text-ink">{t("score")}</p>
          <div className="flex h-8 min-w-12 items-center justify-center rounded-sm border border-border bg-canvas px-5">
            <p className="text-body-sm text-ink">{format.number(question.marksObtained)}</p>
          </div>
        </div>

        {answerStatus ? (
          <div className="flex items-center gap-2">
            <p className="text-body-sm text-ink">{t("yourAnswer")}</p>
            <div className="flex items-center gap-1">
              {answerStatus === "correct" ? <CorrectFilledIconSVG width={16} /> : <IncorrectFilledIconSVG width={16} />}
              <p
                className={`text-body-sm font-medium ${
                  answerStatus === "correct" ? "text-primary" : "text-danger"
                }`}
              >
                {answerStatus === "correct" ? t("correct") : t("incorrect")}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GradedQuestionCard;
