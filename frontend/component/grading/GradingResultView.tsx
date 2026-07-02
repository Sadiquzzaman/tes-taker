import GradingQuestionList from "./GradingQuestionList";

const GradingResultView = ({ data }: GradingModalResultViewProps) => {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 py-4">
        <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#747775]">Answer sheet</p>
        <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#49734F]">
          Score: {data.submission.totalScore}/{data.submission.maxScore}
        </p>
      </div>

      <GradingQuestionList items={data.items} drafts={{}} isReadOnly={true} />
    </div>
  );
};

export default GradingResultView;
