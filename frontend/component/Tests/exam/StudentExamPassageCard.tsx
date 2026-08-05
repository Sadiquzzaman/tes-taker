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
  splitLayout?: boolean;
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
  splitLayout = false,
}: StudentExamPassageCardProps) => {
  const questionRange = `${item.questions[0]?.questionNumber ?? 0}-${item.questions[item.questions.length - 1]?.questionNumber ?? 0}`;
  const instructionLabel = getPassageInstructionLabel(subjectName, subjectCode);

  const passagePanel = (
    <div className="rounded-[8px] px-2 py-2">
      <p className="text-[20px] font-[500] leading-[1.1] tracking-[-0.02em] text-[#232A25]">
        {item.title ? item.title : `${instructionLabel} (${questionRange})`}
      </p>
      {item.audioUrl ? (
        <audio controls src={item.audioUrl} className="mt-3 w-full" preload="metadata">
          Your browser does not support the audio element.
        </audio>
      ) : null}
      <RichTextContent
        html={item.passageText}
        className="mt-3 text-[16px] leading-[1.35] tracking-[-0.02em] text-[#0F1A12]"
      />
    </div>
  );

  const questionsPanel = (
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
  );

  if (splitLayout) {
    return (
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="max-h-[70vh] overflow-y-auto rounded-[8px] bg-white p-3 lg:sticky lg:top-2">
          {passagePanel}
        </div>
        <div className="max-h-[70vh] overflow-y-auto">{questionsPanel}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {passagePanel}
      {questionsPanel}
    </div>
  );
};

export default StudentExamPassageCard;
