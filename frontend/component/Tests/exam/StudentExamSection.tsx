import StudentExamPassageCard from "@/component/Tests/exam/StudentExamPassageCard";
import StudentExamQuestionCard from "@/component/Tests/exam/StudentExamQuestionCard";

interface StudentExamSectionProps {
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
}: StudentExamSectionProps) => {
  return (
    <section className="flex flex-col gap-4">
      {showTitle ? (
        <div className="px-1 pt-1">
          <p className="text-[14px] font-[600] uppercase tracking-[0.08em] text-[#49734F]">{section.title}</p>
          <p className="mt-1 text-[13px] leading-5 text-[#747775]">{section.questionCount} Questions</p>
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
            />
          );
        })}
      </div>
    </section>
  );
};

export default StudentExamSection;
