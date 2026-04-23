import { useEffect, type ReactNode } from "react";

type CreateModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
};

const CreateModal = ({
  open,
  onClose,
  children,
  maxWidthClassName = "max-w-[420px]",
  panelClassName = "p-5 sm:p-6",
}: CreateModalProps) => {
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
        className={`relative z-10 w-full rounded-[20px] bg-white shadow-[0_20px_60px_rgba(35,42,37,0.16)] transition-all duration-300 ${maxWidthClassName} ${panelClassName} ${open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        {children}
      </div>
    </div>
  );
};

export default CreateModal;