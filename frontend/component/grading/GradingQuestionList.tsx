import GradingQuestionCard from "./GradingQuestionCard";
import { RichTextContent } from "@/component/RichTextEditor";

const GradingQuestionList = ({ isReadOnly, items }: GradingModalQuestionListProps) => {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        if (item.kind === "question") {
          return <GradingQuestionCard key={item.id} question={item.question} isReadOnly={isReadOnly} />;
        }

        return (
          <div key={item.id} className="rounded-input border border-border bg-canvas p-4">
            <p className="text-body font-semibold text-ink">Passage</p>
            <RichTextContent
              html={item.passageText}
              className="mt-2 text-body-sm font-normal text-ink-muted"
            />
            <div className="mt-4 flex flex-col gap-4">
              {item.questions.map((question) => (
                <GradingQuestionCard key={question.id} question={question} isReadOnly={isReadOnly} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GradingQuestionList;
