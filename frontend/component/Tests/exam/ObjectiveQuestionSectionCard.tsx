import { RichTextContent } from "@/component/RichTextEditor";

const ObjectiveQuestionSectionCard = ({
  section,
  negativeMarkValue,
  isNegativeMarkingEnabled,
  answerSheet,
  setAnswerSheet,
  disabled,
}: {
  section: StudentExamQuestionSection;
  negativeMarkValue: number;
  isNegativeMarkingEnabled: boolean;
  answerSheet: Record<string, string>;
  setAnswerSheet: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  disabled: boolean;
}) => {
  const getNegativeMarkText = (points: number) => {
    if (!isNegativeMarkingEnabled) {
      return null;
    }

    const negativeMark = (points * negativeMarkValue) / 100;

    return Number.isInteger(negativeMark) ? negativeMark.toString() : negativeMark.toFixed(2);
  };

  return (
    <section className="flex w-full flex-col items-start gap-4 self-stretch rounded-input bg-[rgba(239,240,243,0.75)] p-4">
      <div className="flex flex-col items-start gap-1">
        <p className="text-title font-semibold text-ink">{section.headerText}</p>
        <p className="text-body-sm font-normal text-ink-muted">{section.questions.length} Questions</p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {section.questions.map((question, index) => {
          const negativeMarkText = getNegativeMarkText(question.points);

          return (
            <article key={question.id} className="flex w-full flex-col gap-3 rounded-input bg-surface p-4">
              {question.instruction ? (
                <div className="flex items-start gap-2 rounded-input bg-surface">
                  <span className="mt-[2px] text-body text-primary">•</span>
                  <RichTextContent html={question.instruction} className="text-body-sm font-normal text-primary" />
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="text-body font-medium text-ink">{index + 1}.</span>
                  <RichTextContent
                    html={question.text}
                    className="min-w-0 text-body font-medium text-ink"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2 text-body-sm font-normal text-ink-muted">
                  <span>Points: {question.points}</span>
                  {negativeMarkText ? <span>|</span> : null}
                  {negativeMarkText ? <span>Negative marking: {negativeMarkText}</span> : null}
                </div>
              </div>

              <div className="flex w-full flex-col gap-3">
                {question?.options?.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-2 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      disabled={disabled}
                      checked={answerSheet[question.id] === option.id}
                      onChange={() => {
                        setAnswerSheet((currentAnswerSheet) => ({
                          ...currentAnswerSheet,
                          [question.id]: option.id,
                        }));
                      }}
                      className="h-4 w-4 border-ink text-primary focus:ring-0"
                    />
                    <span className="text-body font-normal text-ink mb-1">{option.text}</span>
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ObjectiveQuestionSectionCard;
