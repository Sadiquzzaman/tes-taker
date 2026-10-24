import NormalInput from "@/Ui/NormalInput";
import { useMemo, useState } from "react";
import AddSubjectModal from "./AddSubjectModal";
import CreateModal from "./CreateModal";

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

  const handleSelect = (subject: SubjectSelectionPayload) => {
    onSelect(subject);
    setSearchText("");
  };

  const handleCreateSubject = (subject: SubjectSelectionPayload) => {
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
          <p className="text-title-sm font-semibold tracking-tight text-ink">Add Subject</p>
          <p className="text-body-sm font-normal text-ink-muted">
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
                parentClassName="h-[44px] w-full rounded-input border-border"
                inputClassName="px-2 text-body font-normal placeholder:text-ink-muted"
                afterIcon={null}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-[280px] overflow-y-auto rounded-card border border-border bg-surface p-2">
          {filteredSubjectOptions.length > 0 ? (
            filteredSubjectOptions.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => handleSelect(subject)}
                className="flex w-full items-center rounded-input px-3 py-2 text-left text-body-sm font-medium text-ink transition-colors hover:bg-primary-soft"
              >
                {subject.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-body-sm font-normal text-ink-muted">
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
