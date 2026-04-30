import CreateModal from "./CreateModal";

type RemoveSubjectConfirmationModalProps = {
  open: boolean;
  subjectName: string;
  onClose: () => void;
  onConfirm: () => void;
};

const RemoveSubjectConfirmationModal = ({
  open,
  subjectName,
  onClose,
  onConfirm,
}: RemoveSubjectConfirmationModalProps) => {
  return (
    <CreateModal open={open} onClose={onClose} maxWidthClassName="max-w-[440px]" panelClassName="p-6 sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.03em] text-[#232A25]">Subject Confirmation</p>
        <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">
          Are you sure you want to remove the {subjectName} subject? This action will permanently delete all associated
          question sections and questions created under it.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-[40px] min-w-[96px] items-center justify-center rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-[40px] min-w-[96px] items-center justify-center rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-white"
        >
          Confirm
        </button>
      </div>
    </CreateModal>
  );
};

export default RemoveSubjectConfirmationModal;
