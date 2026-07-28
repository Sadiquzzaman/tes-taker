import StudentExamQuestionCard from "@/component/Tests/exam/StudentExamQuestionCard";
import { RichTextContent } from "@/component/RichTextEditor";
import { getPassageInstructionLabel } from "@/utils/richText";

interface StudentExamPassageCardProps {
  item: StudentExamPassageItem;
  answerState: ExamAnswerState;
  disabled: boolean;
  isNegativeMarkingEnabled: boolean;
  negativeMarkValue: number;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
  onMatchingChange: (questionId: string, value: string[]) => void;
  subjectName?: string;
  subjectCode?: string;
}

const StudentExamPassageCard = ({
  item,
  answerState,
  disabled,
  isNegativeMarkingEnabled,
  negativeMarkValue,
  onAnswerChange,
  onMatchingChange,
  subjectName,
  subjectCode,
}: StudentExamPassageCardProps) => {
  const questionRange = `${item.questions[0]?.questionNumber ?? 0}-${item.questions[item.questions.length - 1]?.questionNumber ?? 0}`;
  const instructionLabel = getPassageInstructionLabel(subjectName, subjectCode);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[8px] px-2 py-2">
        <p className="text-[20px] font-[500] leading-[1.1] tracking-[-0.02em] text-[#232A25]">
          {instructionLabel} ({questionRange})
        </p>
        <RichTextContent
          html={item.passageText}
          className="mt-3 text-[16px] leading-[1.35] tracking-[-0.02em] text-[#0F1A12]"
        />
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
