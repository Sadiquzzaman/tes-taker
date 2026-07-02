import GradingQuestionCard from "./GradingQuestionCard";

const GradingQuestionList = ({
  drafts,
  isReadOnly,
  items,
  onExplanationChange,
  onScoreBlur,
  onScoreChange,
}: GradingModalQuestionListProps) => {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        if (item.kind === "question") {
          return (
            <GradingQuestionCard
              key={item.id}
              question={item.question}
              draft={drafts[item.question.id]}
              isReadOnly={isReadOnly}
              onExplanationChange={onExplanationChange}
              onScoreBlur={onScoreBlur}
              onScoreChange={onScoreChange}
            />
          );
        }

        return (
          <div key={item.id} className="rounded-[8px] border border-[#E5E5E5] bg-[#F8F9FA] p-4">
            <p className="text-[16px] font-[600] leading-[24px] text-[#232A25]">Passage</p>
            <p className="mt-2 text-[14px] font-[400] leading-[24px] text-[#747775]">{item.passageText}</p>
            <div className="mt-4 flex flex-col gap-4">
              {item.questions.map((question) => (
                <GradingQuestionCard
                  key={question.id}
                  question={question}
                  draft={drafts[question.id]}
                  isReadOnly={isReadOnly}
                  onExplanationChange={onExplanationChange}
                  onScoreBlur={onScoreBlur}
                  onScoreChange={onScoreChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GradingQuestionList;
