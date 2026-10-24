import CreateModal from "./CreateModal";

const RemoveSubjectConfirmationModal = ({
  open,
  subjectName,
  onClose,
  onConfirm,
}: RemoveSubjectConfirmationModalProps) => {
  return (
    <CreateModal open={open} onClose={onClose} maxWidthClassName="max-w-[440px]" panelClassName="p-6 sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="text-title-sm font-semibold tracking-tight text-ink">Subject Confirmation</p>
        <p className="text-body-sm font-normal text-ink-muted">
          Are you sure you want to remove the {subjectName} subject? This action will permanently delete all associated
          question sections and questions created under it.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-[40px] min-w-[96px] items-center justify-center rounded-input bg-canvas px-4 text-body-sm font-medium text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-[40px] min-w-[96px] items-center justify-center rounded-input bg-primary px-4 text-body-sm font-medium text-ink-inverse"
        >
          Confirm
        </button>
      </div>
    </CreateModal>
  );
};

export default RemoveSubjectConfirmationModal;
