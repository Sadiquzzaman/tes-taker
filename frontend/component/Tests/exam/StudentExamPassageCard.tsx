import StudentExamQuestionCard from "@/component/Tests/exam/StudentExamQuestionCard";
import { RichTextContent } from "@/component/RichTextEditor";
import { useTranslations } from "next-intl";
import { getPassageInstructionByLanguage, resolvePassageInstructionLanguage } from "@/utils/richText";

interface StudentExamPassageCardProps {
  flagged?: Set<string>;
  onToggleFlag?: (questionId: string) => void;
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
  flagged,
  onToggleFlag,
}: StudentExamPassageCardProps) => {
  const t = useTranslations("exam");
  const questionRange = `${item.questions[0]?.questionNumber ?? 0}-${item.questions[item.questions.length - 1]?.questionNumber ?? 0}`;
  const instructionLanguage = resolvePassageInstructionLanguage(
    item.instructionLanguage,
    subjectName,
    subjectCode,
  );
  const instructionLabel = getPassageInstructionByLanguage(instructionLanguage);

  const passagePanel = (
    <div className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <p className="text-title-sm font-medium text-ink">
        {item.title ? item.title : `${instructionLabel} (${questionRange})`}
      </p>
      {item.audioUrl ? (
        <audio controls src={item.audioUrl} className="mt-3 w-full" preload="metadata">
          {t("noAudioSupport")}
        </audio>
      ) : null}
      <RichTextContent
        html={item.passageText}
        className="mt-3 text-body text-ink"
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
          flagged={flagged?.has(question.id)}
          onToggleFlag={onToggleFlag}
        />
      ))}
    </div>
  );

  if (splitLayout) {
    return (
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="max-h-[70vh] overflow-y-auto lg:sticky lg:top-2">
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
