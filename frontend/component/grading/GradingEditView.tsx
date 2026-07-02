import GradingQuestionList from "./GradingQuestionList";

const GradingEditView = ({
  data,
  drafts,
  onExplanationChange,
  onScoreBlur,
  onScoreChange,
}: GradingModalEditViewProps) => {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#747775]">Answer sheet</p>
        <p className="text-[14px] font-[400] leading-[20px] text-[#747775]">
          Manual graded: {data.totals.manualGradedCount}/{data.totals.manualTotalCount}
        </p>
      </div>

      <GradingQuestionList
        items={data.items}
        drafts={drafts}
        isReadOnly={false}
        onExplanationChange={onExplanationChange}
        onScoreBlur={onScoreBlur}
        onScoreChange={onScoreChange}
      />
    </div>
  );
};

export default GradingEditView;
