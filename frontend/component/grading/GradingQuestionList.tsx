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
          <div key={item.id} className="rounded-[8px] border border-[#E5E5E5] bg-[#F8F9FA] p-4">
            <p className="text-[16px] font-[600] leading-[24px] text-[#232A25]">Passage</p>
            <RichTextContent
              html={item.passageText}
              className="mt-2 text-[14px] font-[400] leading-[24px] text-[#747775]"
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
