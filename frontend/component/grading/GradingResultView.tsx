import GradingQuestionList from "./GradingQuestionList";

const GradingResultView = ({ data }: GradingModalResultViewProps) => {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 py-4">
        <p className="text-title-sm font-medium text-ink-muted">Answer sheet</p>
        <p className="text-title-sm font-medium text-primary">
          Score: {data.submission.totalScore}/{data.submission.maxScore}
        </p>
      </div>

      <GradingQuestionList items={data.items} isReadOnly={true} />
    </div>
  );
};

export default GradingResultView;
