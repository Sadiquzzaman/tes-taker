import GradingQuestionCard from "./GradingQuestionCard";
import { RichTextContent } from "@/component/RichTextEditor";
import { useTranslations } from "next-intl";

const GradingQuestionList = ({ isReadOnly, items }: GradingModalQuestionListProps) => {
  const t = useTranslations("grading.modal");
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        if (item.kind === "question") {
          return <GradingQuestionCard key={item.id} question={item.question} isReadOnly={isReadOnly} />;
        }

        return (
          <div key={item.id} className="rounded-input border border-border bg-canvas p-4">
            <p className="text-body-sm font-semibold uppercase tracking-wide text-ink-muted">{t("passage")}</p>
            <RichTextContent
              html={item.passageText}
              className="mt-2 text-body text-ink"
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
