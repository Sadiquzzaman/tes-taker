import CloseIconSVG from "../svg/CloseIconSvg";
import GradingEditView from "./GradingEditView";
import GradingResultView from "./GradingResultView";
import useGradingModal from "@/hooks/grading/useGradingModal";
import { RotatingLines } from "react-loader-spinner";

const GradingModel = () => {
  const {
    data,
    handleClose,
    handleExplanationChange,
    handleScoreBlur,
    handleScoreChange,
    loading,
    modalTitle,
    openModal,
    questionDrafts,
  } = useGradingModal();

  return (
    <div
      className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
        openModal ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
      aria-hidden="true"
    >
      <div
        className={`absolute top-2 right-2 z-50 h-[calc(100vh-8px)] w-[calc(100vw-8px)] overflow-auto rounded-xl bg-white p-4 shadow-lg transition-transform duration-500 sm:w-[584px] sm:p-8 ${
          openModal ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        style={{ maxHeight: "calc(100vh - 16px)" }}
        aria-modal="true"
        role="dialog"
      >
        <div className="flex items-center justify-between">
          <p className="text-[24px] font-[600] leading-[24px] tracking-[-0.02em] text-[#232A25]">{modalTitle}</p>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <CloseIconSVG className="h-6 w-6" stroke="currentColor" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <RotatingLines
              visible={true}
              height="40"
              width="40"
              color="grey"
              strokeWidth="5"
              animationDuration="0.75"
              ariaLabel="submission-grading-loading"
            />
          </div>
        ) : null}

        {!loading && data && openModal === "result" ? <GradingResultView data={data} /> : null}
        {!loading && data && openModal === "edit" ? (
          <GradingEditView
            data={data}
            drafts={questionDrafts}
            onExplanationChange={handleExplanationChange}
            onScoreBlur={handleScoreBlur}
            onScoreChange={handleScoreChange}
          />
        ) : null}
        {!loading && !data && openModal ? (
          <div className="flex min-h-[320px] items-center justify-center text-[14px] text-[#747775]">
            No submission data found.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GradingModel;
