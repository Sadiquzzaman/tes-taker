import StudentExamMatchingOrderInput from "@/component/Tests/exam/StudentExamMatchingOrderInput";
import NotmalTextFeild from "@/Ui/NotmalTextFeild";
import { toggleMultiSelectAnswer } from "@/utils/tests/studentExamAnswers";

interface StudentExamQuestionCardProps {
  question: StudentExamViewQuestion;
  answerState: ExamAnswerState;
  disabled: boolean;
  isNegativeMarkingEnabled: boolean;
  negativeMarkValue: number;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
  onMatchingChange: (questionId: string, value: string[]) => void;
}

const StudentExamQuestionCard = ({
  question,
  answerState,
  disabled,
  isNegativeMarkingEnabled,
  negativeMarkValue,
  onAnswerChange,
  onMatchingChange,
}: StudentExamQuestionCardProps) => {
  const answerValue = answerState[question.id];
  const textValue = typeof answerValue === "string" ? answerValue : "";
  const selectedOptionIds = Array.isArray(answerValue) ? answerValue : [];
  const negativeMark =
    isNegativeMarkingEnabled && question.isAutoScored ? ((question.points * negativeMarkValue) / 100).toFixed(2) : null;

  return (
    <article className="flex w-full flex-col gap-3 rounded-[8px] bg-white p-4">
      {question.instruction ? <div className="text-[14px] leading-5 text-[#49734F]">{question.instruction}</div> : null}

      <div className="flex min-w-0 gap-2">
        <span className="w-4 shrink-0 text-center text-[16px] font-[500] leading-5 text-[#0F1A12]">
          {question.questionNumber}.
        </span>
        <p className="text-[16px] font-[500] leading-5 tracking-[-0.02em] text-[#0F1A12]">{question.text}</p>
      </div>

      {question.inputMode === "text" ? (
        <div className="flex flex-col gap-3">
          <NotmalTextFeild
            value={textValue}
            onChange={(event) => onAnswerChange(question.id, event.target.value)}
            placeholder="Write answer here"
            rows={4}
            maxRows={6}
            disabled={disabled}
            parentClassName="rounded-[6px] border-[#E5E5E5] bg-white px-3 py-[10px]"
            inputClassName="text-[16px] font-[400] leading-5 tracking-[-0.02em] text-[#232A25] placeholder:text-[#747775]"
          />
        </div>
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
                className="h-4 w-4 border-[#232A25] text-[#49734F] focus:ring-0"
              />
              <span className="text-[16px] leading-4 tracking-[-0.02em] text-[#232A25]">{option.text}</span>
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
                className="h-4 w-4 rounded border-[#232A25] text-[#49734F] focus:ring-0"
              />
              <span className="text-[16px] leading-4 tracking-[-0.02em] text-[#232A25]">{option.text}</span>
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
          <p className="text-[14px] leading-5 tracking-[-0.02em] text-[#747775]">
            Word count {textValue.trim() ? textValue.trim().split(/\s+/).length : 0}
          </p>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 text-[14px] leading-5 tracking-[-0.02em] text-[#747775]">
          <span>Points: {question.points}</span>
          {negativeMark ? <span>|</span> : null}
          {negativeMark ? <span>Negative marking: {negativeMark}</span> : null}
        </div>
      </div>
    </article>
  );
};

export default StudentExamQuestionCard;
