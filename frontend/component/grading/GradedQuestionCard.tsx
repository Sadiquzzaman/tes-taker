import CorrectFilledIconSVG from "../svg/CorrectFilledIconSVG";
import IncorrectFilledIconSVG from "../svg/IncorrectFilledIconSVG";
import GradingAnswerView from "./GradingAnswerView";

const formatScoreLabel = (value: number) => {
  return String(value);
};

const GradedQuestionCard = ({ question }: GradingModalGradedQuestionCardProps) => {
  const answerStatus = question.isCorrect === true ? "correct" : question.isCorrect === false ? "incorrect" : null;

  return (
    <div className="flex flex-col gap-6 rounded-[8px] border border-[#E5E5E5] bg-white p-5">
      <div className="flex flex-col gap-3">
        {question.instruction ? (
          <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">{question.instruction}</p>
        ) : null}
        <div className="flex items-start gap-2 text-[#0F1A12]">
          <span className="w-4 shrink-0 text-center text-[16px] font-[500] leading-[1.25] tracking-[-0.02em]">
            {question.questionNumber}.
          </span>
          <p className="flex-1 text-[16px] font-[500] leading-[1.25] tracking-[-0.02em]">{question.question}</p>
        </div>
      </div>

      {question.imageUrl ? <img src={question.imageUrl} alt="Question" className="max-h-[240px] rounded-[8px] object-contain" /> : null}

      <GradingAnswerView question={question} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-[400] leading-[1.25] tracking-[-0.02em] text-[#232A25]">Score</p>
          <div className="flex h-8 min-w-12 items-center justify-center rounded-[2px] border border-[#E5E5E5] bg-[#EFF0F3] px-5">
            <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">{formatScoreLabel(question.marksObtained)}</p>
          </div>
        </div>

        {answerStatus ? (
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-[400] leading-[1.25] tracking-[-0.02em] text-[#232A25]">Your answer</p>
            <div className="flex items-center gap-1">
              {answerStatus === "correct" ? <CorrectFilledIconSVG width={16} /> : <IncorrectFilledIconSVG width={16} />}
              <p
                className={`text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${
                  answerStatus === "correct" ? "text-[#49734F]" : "text-[#D24B44]"
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
