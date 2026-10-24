import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import IncorrectFilledIconSVG from "../svg/IncorrectFilledIconSVG";
import GradingAnswerView from "./GradingAnswerView";
import { RichTextContent } from "@/component/RichTextEditor";

const formatScoreLabel = (value: number) => {
  return String(value);
};

const GradedQuestionCard = ({ question }: GradingModalGradedQuestionCardProps) => {
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
          <span className="w-4 shrink-0 text-center text-body font-medium">
            {question.questionNumber}.
          </span>
          <RichTextContent
            html={question.question}
            className="flex-1 text-body font-medium"
          />
        </div>
      </div>

      {question.imageUrl ? (
        <img src={question.imageUrl} alt="Question" className="max-h-[240px] rounded-input object-contain" />
      ) : null}

      <GradingAnswerView question={question} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-body-sm font-normal text-ink">Score</p>
          <div className="flex h-8 min-w-12 items-center justify-center rounded-sm border border-border bg-canvas px-5">
            <p className="text-body-sm font-normal text-ink">
              {formatScoreLabel(question.marksObtained)}
            </p>
          </div>
        </div>

        {answerStatus ? (
          <div className="flex items-center gap-2">
            <p className="text-body-sm font-normal text-ink">Your answer</p>
            <div className="flex items-center gap-1">
              {answerStatus === "correct" ? <CorrectFilledIconSVG width={16} /> : <IncorrectFilledIconSVG width={16} />}
              <p
                className={`text-body-sm font-medium ${
                  answerStatus === "correct" ? "text-primary" : "text-danger"
                }`}
              >
                {answerStatus === "correct" ? "Correct" : "Incorrect"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GradedQuestionCard;
