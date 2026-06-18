import StudentExamQuestionCard from "@/component/Tests/exam/StudentExamQuestionCard";

interface StudentExamPassageCardProps {
  item: StudentExamPassageItem;
  answerState: ExamAnswerState;
  disabled: boolean;
  isNegativeMarkingEnabled: boolean;
  negativeMarkValue: number;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
  onMatchingChange: (questionId: string, value: string[]) => void;
}

const StudentExamPassageCard = ({
  item,
  answerState,
  disabled,
  isNegativeMarkingEnabled,
  negativeMarkValue,
  onAnswerChange,
  onMatchingChange,
}: StudentExamPassageCardProps) => {
  const questionRange = `${item.questions[0]?.questionNumber ?? 0}-${item.questions[item.questions.length - 1]?.questionNumber ?? 0}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[8px] px-2 py-2">
        <p className="text-[20px] font-[500] leading-[1.1] tracking-[-0.02em] text-[#232A25]">
          Read the passage below and answer the following questions ({questionRange})
        </p>
        <p className="mt-3 text-[16px] leading-[1.2] tracking-[-0.02em] text-[#0F1A12]">{item.passageText}</p>
      </div>

      <div className="flex flex-col gap-4">
        {item.questions.map((question) => (
          <StudentExamQuestionCard
            key={question.id}
            question={question}
            answerState={answerState}
            disabled={disabled}
            isNegativeMarkingEnabled={isNegativeMarkingEnabled}
            negativeMarkValue={negativeMarkValue}
            onAnswerChange={onAnswerChange}
            onMatchingChange={onMatchingChange}
          />
        ))}
      </div>
    </div>
  );
};

export default StudentExamPassageCard;
