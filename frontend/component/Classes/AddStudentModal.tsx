import useAddStudent from "@/hooks/classes/useAddStudent";
import CrossIconSVG from "../svg/CrossIconSVG";
import TagInput from "@/Ui/TagInput";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import Link from "next/link";
import ButtonLoader from "../Loader/ButtonLoadder";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";

const AddStudentModal = ({ fetchClassDetails }: { fetchClassDetails: () => void }) => {
  const {
    openAddStudentModal,
    value,
    setValue,
    students,
    fileInputRef,
    tagInputRef,
    invalidStudentIndices,
    loading,
    addTag,
    handleCsvUpload,
    handleDownloadTemplate,
    removeTag,
    handleTagClick,
    handleClose,
    handleAddStudent,
  } = useAddStudent(fetchClassDetails);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          openAddStudentModal ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        aria-hidden="true"
      >
        <div
          className={`absolute top-2 right-2 h-[calc(100vh-8px)] w-[calc(100vw-8px)] sm:w-[584px] z-50 bg-white rounded-xl p-4 sm:p-8 shadow-lg overflow-auto transition-transform duration-500 ${
            openAddStudentModal ? "translate-x-0" : "translate-x-full pointer-events-none"
          }`}
          style={{ maxHeight: "calc(100vh - 16px)" }}
          aria-modal="true"
          role="dialog"
        >
          <div className="pb-4 flex justify-between items-center">
            <p className="font-[600] text-[24px] leading-[24px] tracking-[-0.04em] text-[#232A25]">Add Student</p>
            <button className="text-[#747775]" onClick={handleClose}>
              <CrossIconSVG width={24} />
            </button>
          </div>
          <div className="h-[200px] rounded-lg bg-[#EFF0F3] my-4 flex justify-center items-center">
            <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">GIF Tutorial</p>
          </div>
          <div className="w-full flex flex-col gap-4 pt-4">
            <p className={`font-[500] text-[16px] leading-[16px] tracking-[-0.02em] text-[#0F1A12]`}>
              Enter student email or phone
            </p>
            <TagInput
              placeholder="Enter student email or phone"
              inputClassName="px-2"
              afterIcon={null}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              tags={students}
              removeTag={removeTag}
              addTag={addTag}
              invalidTagIndices={invalidStudentIndices}
              onTagClick={handleTagClick}
              inputRef={tagInputRef}
            />
          </div>
          <div className="flex flex-col gap-3 mt-4 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex flex-col gap-2">
              <p className={`font-[400] text-[14px] leading-[14px] tracking-[-0.02em] text-[#747775]`}>
                Invite by single/bulk email or phone.
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-[32px] rounded-lg border border-[#C6CFCF] px-3 text-sm font-medium tracking-[-0.02em] text-[#232A25]"
                >
                  Upload CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="h-[32px] rounded-lg border border-[#C6CFCF] px-3 text-sm font-medium tracking-[-0.02em] text-[#49734F]"
                >
                  Download demo Excel
                </button>
                {invalidStudentIndices.length > 0 && (
                  <p className="text-[12px] leading-[14px] tracking-[-0.02em] text-[#C1121F]">
                    Invalid items are highlighted in red. Click one to edit it.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={addTag}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 w-[71px] h-[32px] ${
                value.trim() === "" ? "bg-[#747775]" : "bg-[#232A25]"
              } rounded-lg text-white text-sm font-medium tracking-[-0.02em] capitalize`}
            >
              <HumanAddIconSVG />
              Add
            </button>
          </div>
          <div className="flex justify-end items-center gap-2 sm:gap-4 mt-6">
            <Link
              href="/classes"
              className={`px-4 h-10 flex items-center justify-center rounded-[8px] text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${
                loading ? "bg-[#747775]" : "bg-[#EFF0F3]"
              } text-[#232A25]`}
            >
              Cancel
            </Link>
            <button
              onClick={handleAddStudent}
              disabled={loading}
              className={`px-4 h-10 flex items-center justify-center rounded-[8px] text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${
                loading ? "bg-[#747775]" : "bg-[#49734F]"
              } text-[#FFFFFF]`}
            >
              <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
              {loading ? "Confirming..." : "Confirm"}
              <RightArrowIconSVG />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddStudentModal;
