import NormalInput from "@/Ui/NormalInput";
import { useMemo, useState } from "react";
import AddSubjectModal from "./AddSubjectModal";
import CreateModal from "./CreateModal";

type AddQuestionSubjectModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (subject: { id: string; label: string; value: string }) => void;
  subjectOptions: Array<{ id: string; label: string; value: string }>;
};

const AddQuestionSubjectModal = ({ open, onClose, onSelect, subjectOptions }: AddQuestionSubjectModalProps) => {
  const [searchText, setSearchText] = useState("");
  const [isCreateSubjectModalOpen, setIsCreateSubjectModalOpen] = useState(false);

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

  const handleClose = () => {
    setSearchText("");
    setIsCreateSubjectModalOpen(false);
    onClose();
  };

  return (
    <>
      <CreateModal open={open} onClose={handleClose} maxWidthClassName="max-w-[420px]" panelClassName="p-5 sm:p-6">
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
      </CreateModal>

      <AddSubjectModal
        open={isCreateSubjectModalOpen}
        onClose={() => setIsCreateSubjectModalOpen(false)}
        onCreated={handleCreateSubject}
      />
    </>
  );
};

export default AddQuestionSubjectModal;
