import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import GradingQuestionList from "./GradingQuestionList";
import useGradingSubmissionFooter from "@/hooks/grading/useGradingSubmissionFooter";

const GradingEditView = ({ data }: GradingModalEditViewProps) => {
  const { handleClose, handleSubmit, isSubmitting, isSubmitDisabled } = useGradingSubmissionFooter();

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#747775]">Answer sheet</p>
        <p className="text-[14px] font-[400] leading-[20px] text-[#747775]">
          Manual graded: {data.totals.manualGradedCount}/{data.totals.manualTotalCount}
        </p>
      </div>

      <GradingQuestionList items={data.items} isReadOnly={false} />

      <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleClose}
          className="flex h-12 items-center justify-center rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-5 text-[#232A25]"
        >
          Save & Exit
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-12 items-center justify-center rounded-[8px] px-4 text-[14px] font-[500] leading-5 text-[#232A25]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`flex h-12 items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-[500] leading-5 ${
              isSubmitDisabled ? "cursor-not-allowed bg-[#B7C4B9] text-white" : "bg-[#49734F] text-white"
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
