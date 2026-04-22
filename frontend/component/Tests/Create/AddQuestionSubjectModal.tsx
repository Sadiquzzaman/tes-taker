import PlusIcon from "@/component/svg/PlusIcon";
import NormalInput from "@/Ui/NormalInput";
import { useEffect, useMemo, useState } from "react";
import AddSubjectModal from "./AddSubjectModal";

type AddQuestionSubjectModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (subject: { id: string; label: string; value: string }) => void;
  subjectOptions: Array<{ id: string; label: string; value: string }>;
};

const AddQuestionSubjectModal = ({ open, onClose, onSelect, subjectOptions }: AddQuestionSubjectModalProps) => {
  const [searchText, setSearchText] = useState("");
  const [isCreateSubjectModalOpen, setIsCreateSubjectModalOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchText("");
      setIsCreateSubjectModalOpen(false);
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const filteredSubjectOptions = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    if (!normalizedSearch) {
      return subjectOptions.slice(0, 10);
    }

    return subjectOptions.filter((subject) => subject.label.toLowerCase().includes(normalizedSearch)).slice(0, 10);
  }, [searchText, subjectOptions]);

  const handleSelect = (subject: { id: string; label: string; value: string }) => {
    onSelect(subject);
    setSearchText("");
  };

  const handleCreateSubject = (subject: { id: string; label: string; value: string }) => {
    setIsCreateSubjectModalOpen(false);
    handleSelect(subject);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`relative z-10 w-full max-w-[420px] rounded-[20px] bg-white p-5 shadow-[0_20px_60px_rgba(35,42,37,0.16)] transition-all duration-300 sm:p-6 ${open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div className="flex flex-col gap-1">
          <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.03em] text-[#232A25]">Add Subject</p>
          <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">
            Search the subject catalog and add a subject to this model test.
          </p>
        </div>

        <div className="mt-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <NormalInput
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search subject"
                parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
                inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
                afterIcon={null}
              />
            </div>
            {/* <button
              type="button"
              onClick={() => setIsCreateSubjectModalOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#E5E5E5] transition-colors duration-200 hover:bg-[#F8F8F8]"
              title="Add new subject"
              aria-label="Add new subject"
            >
              <PlusIcon />
            </button> */}
          </div>
        </div>

        <div className="mt-4 max-h-[280px] overflow-y-auto rounded-[12px] border border-[#E5E5E5] bg-white p-2">
          {filteredSubjectOptions.length > 0 ? (
            filteredSubjectOptions.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => handleSelect(subject)}
                className="flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[14px] font-[500] leading-[16px] text-[#232A25] transition-colors hover:bg-[#49734F0D]"
              >
                {subject.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-[14px] font-[400] leading-[16px] text-[#747775]">
              No subjects found
            </div>
          )}
        </div>
      </div>

      <AddSubjectModal
        open={isCreateSubjectModalOpen}
        onClose={() => setIsCreateSubjectModalOpen(false)}
        onCreated={handleCreateSubject}
      />
    </div>
  );
};

export default AddQuestionSubjectModal;
