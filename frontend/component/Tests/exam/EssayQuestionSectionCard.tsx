import NotmalTextFeild from "@/Ui/NotmalTextFeild";
import { RichTextContent } from "@/component/RichTextEditor";

const EssayQuestionSectionCard = ({
  section,
  answerSheet,
  setAnswerSheet,
  disabled,
}: {
  section: StudentExamQuestionSection;
  answerSheet: Record<string, string>;
  setAnswerSheet: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  disabled: boolean;
}) => {
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswerSheet((currentAnswerSheet) => ({
      ...currentAnswerSheet,
      [questionId]: value,
    }));
  };

  return (
    <section className="flex w-full flex-col items-start gap-4 self-stretch rounded-input bg-[rgba(239,240,243,0.75)] p-4">
      <div className="flex flex-col items-start gap-1">
        <p className="text-title font-semibold text-ink">{section.headerText}</p>
        <p className="text-body-sm font-normal text-ink-muted">{section.questions.length} Questions</p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {section.questions.map((question, index) => (
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
              <span className="shrink-0 text-body-sm font-normal text-ink-muted">
                Points: {question.points}
              </span>
            </div>

            <NotmalTextFeild
              value={answerSheet[question.id] ?? ""}
              onChange={(event) => handleAnswerChange(question.id, event.target.value)}
              placeholder="Write your answer"
              rows={4}
              maxRows={4}
              disabled={disabled}
              parentClassName="border-border bg-surface px-3 py-3"
              inputClassName="text-body font-normal text-ink placeholder:text-ink-muted"
            />

            <p className="text-body-sm font-normal text-ink-muted">
              Word count {answerSheet[question.id]?.trim() ? answerSheet[question.id].trim().split(/\s+/).length : 0}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default EssayQuestionSectionCard;
