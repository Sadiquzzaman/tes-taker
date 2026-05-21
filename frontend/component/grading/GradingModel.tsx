import CloseIconSVG from "../svg/CloseIconSvg";
import GradingEditView from "./GradingEditView";
import GradingResultView from "./GradingResultView";
import useGradingModal from "@/hooks/grading/useGradingModal";

interface GradingModelProps {
  openModal: GradingModalView;
  setOpenModal: (open: GradingModalView) => void;
}

const GradingModel = ({ openModal, setOpenModal }: GradingModelProps) => {
  const { allQuestion, handleClose, handleExplanationChange, questionInputData } = useGradingModal(
    setOpenModal,
    openModal,
  );

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
          <p className="text-[24px] font-[600] leading-[24px] tracking-[-0.02em] text-[#232A25]">
            {openModal === "edit" ? "Grade Submission" : "View Result"}
          </p>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <CloseIconSVG className="h-6 w-6" stroke="currentColor" />
          </button>
        </div>

        {openModal === "result" && <GradingResultView allQuestion={allQuestion} setOpenModal={setOpenModal} />}
        {openModal === "edit" && (
          <GradingEditView handleExplanationChange={handleExplanationChange} questionInputData={questionInputData} />
        )}
      </div>
    </div>
  );
};

export default GradingModel;
