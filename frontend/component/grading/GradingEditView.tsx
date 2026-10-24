import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import GradingQuestionList from "./GradingQuestionList";
import useGradingSubmissionFooter from "@/hooks/grading/useGradingSubmissionFooter";

const GradingEditView = ({ data }: GradingModalEditViewProps) => {
  const { handleClose, handleSubmit, isSubmitting, isSubmitDisabled } = useGradingSubmissionFooter();

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-title-sm font-medium text-ink-muted">Answer sheet</p>
        <p className="text-body-sm font-normal text-ink-muted">
          Manual graded: {data.totals.manualGradedCount}/{data.totals.manualTotalCount}
        </p>
      </div>

      <GradingQuestionList items={data.items} isReadOnly={false} />

      <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleClose}
          className="flex h-12 items-center justify-center rounded-input bg-canvas px-4 text-body-sm font-medium leading-5 text-ink"
        >
          Save & Exit
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-12 items-center justify-center rounded-input px-4 text-body-sm font-medium leading-5 text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`flex h-12 items-center justify-center gap-2 rounded-input px-4 text-body-sm font-medium leading-5 ${
              isSubmitDisabled ? "cursor-not-allowed bg-primary/40 text-ink-inverse" : "bg-primary text-ink-inverse"
            }`}
          >
            <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
            {isSubmitting ? null : <RightArrowIconSVG className="size-4" strokeWidth={1.8} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GradingEditView;
