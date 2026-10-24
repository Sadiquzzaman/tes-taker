import StudentExamPassageCard from "@/component/Tests/exam/StudentExamPassageCard";
import StudentExamQuestionCard from "@/component/Tests/exam/StudentExamQuestionCard";
import { useTranslations } from "next-intl";

interface StudentExamSectionProps {
  flagged: Set<string>;
  onToggleFlag: (questionId: string) => void;
  section: StudentExamViewSection;
  answerState: ExamAnswerState;
  disabled: boolean;
  isNegativeMarkingEnabled: boolean;
  negativeMarkValue: number;
  showTitle: boolean;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
  onMatchingChange: (questionId: string, value: string[]) => void;
}

const StudentExamSection = ({
  section,
  answerState,
  disabled,
  isNegativeMarkingEnabled,
  negativeMarkValue,
  showTitle,
  onAnswerChange,
  onMatchingChange,
  flagged,
  onToggleFlag,
}: StudentExamSectionProps) => {
  const t = useTranslations("exam");

  return (
    <section className="flex flex-col gap-4">
      {showTitle ? (
        <div className="px-1 pt-1">
          <h2 className="text-body-sm font-semibold uppercase tracking-wide text-primary">{section.title}</h2>
          <p className="mt-1 text-body-sm leading-5 text-ink-muted">{t("questionCount", { count: section.questionCount })}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {section.items.map((item) => {
          if (item.kind === "passage") {
            return (
              <StudentExamPassageCard
                key={item.id}
                item={item}
                answerState={answerState}
                disabled={disabled}
                isNegativeMarkingEnabled={isNegativeMarkingEnabled}
                negativeMarkValue={negativeMarkValue}
                onAnswerChange={onAnswerChange}
                onMatchingChange={onMatchingChange}
                subjectName={section.subjectName ?? section.title}
                subjectCode={section.subjectCode}
                splitLayout={Boolean(section.id?.startsWith("ielts."))}
                flagged={flagged}
                onToggleFlag={onToggleFlag}
              />
            );
          }

          return (
            <StudentExamQuestionCard
              key={item.id}
              question={item.question}
              answerState={answerState}
              disabled={disabled}
              isNegativeMarkingEnabled={isNegativeMarkingEnabled}
              negativeMarkValue={negativeMarkValue}
              onAnswerChange={onAnswerChange}
              onMatchingChange={onMatchingChange}
              flagged={flagged.has(item.question.id)}
              onToggleFlag={onToggleFlag}
            />
          );
        })}
      </div>
    </section>
  );
};

export default StudentExamSection;
