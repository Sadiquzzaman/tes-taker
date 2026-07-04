import CorrectFilledIconSVG from "@/component/svg/CorrectFilledIconSVG";
import IncorrectFilledIconSVG from "@/component/svg/IncorrectFilledIconSVG";

const StudentResultQuestionCard = ({
  answer,
  questionNumber,
}: {
  answer: StudentExamResultAnswer;
  questionNumber: number;
}) => {
  const isTextQuestion = answer.question_type?.toLowerCase() === "subjective" || Boolean(answer.text_answer);
  const studentAnswer = isTextQuestion
    ? answer.text_answer || "No answer submitted"
    : answer.selected_answer || "No answer submitted";
  const answerStatus =
    answer.is_correct === true ? "correct" : answer.is_correct === false ? "incorrect" : null;

  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-[#E5E5E5] bg-white p-5">
      <div className="flex items-start gap-2 text-[#0F1A12]">
        <span className="w-4 shrink-0 text-center text-[16px] font-[500] leading-[1.25] tracking-[-0.02em]">
          {questionNumber}.
        </span>
        <p className="flex-1 text-[16px] font-[500] leading-[1.25] tracking-[-0.02em]">{answer.question}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]">Your answer</p>
        <p className="text-[16px] font-[400] leading-[1.2] tracking-[-0.02em] text-[#747775]">{studentAnswer}</p>
      </div>

      {!isTextQuestion && answer.correct_answer ? (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]">Correct answer</p>
          <p className="text-[16px] font-[400] leading-[1.2] tracking-[-0.02em] text-[#49734F]">{answer.correct_answer}</p>
        </div>
      ) : null}

      {answer.explanation ? (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]">Explanation</p>
          <p className="text-[14px] font-[400] leading-[1.4] tracking-[-0.02em] text-[#747775]">{answer.explanation}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-[400] leading-[1.25] tracking-[-0.02em] text-[#232A25]">Score</p>
          <div className="flex h-8 min-w-12 items-center justify-center rounded-[2px] border border-[#E5E5E5] bg-[#EFF0F3] px-5">
            <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#232A25]">
              {answer.marks_obtained ?? 0}
            </p>
          </div>
        </div>

        {answerStatus ? (
          <div className="flex items-center gap-2">
            {answerStatus === "correct" ? <CorrectFilledIconSVG width={16} /> : <IncorrectFilledIconSVG width={16} />}
            <p
              className={`text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${
                answerStatus === "correct" ? "text-[#49734F]" : "text-[#D24B44]"
              }`}
            >
              {answerStatus === "correct" ? "Correct" : "Incorrect"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StudentResultQuestionCard;
