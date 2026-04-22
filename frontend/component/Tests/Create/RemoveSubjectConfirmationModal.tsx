import { useEffect } from "react";

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
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
        className={`relative z-10 w-full max-w-[440px] rounded-[20px] bg-white p-6 shadow-[0_20px_60px_rgba(35,42,37,0.16)] transition-all duration-300 sm:p-7 ${open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div className="flex flex-col gap-2">
          <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.03em] text-[#232A25]">
            Subject Confirmation
          </p>
          <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">
            Are you sure you want to remove the {subjectName} subject? This action will permanently delete all
            associated question sections and questions created under it.
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
      </div>
    </div>
  );
};

export default RemoveSubjectConfirmationModal;
