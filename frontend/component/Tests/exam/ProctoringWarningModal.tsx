"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import ImportantIconSvg from "@/component/svg/ImportantIconSvg";
import { dismissProctoringWarning } from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

const ProctoringWarningModal = () => {
  const dispatch = useAppDispatch();
  const pendingWarning = useAppSelector((state) => state.proctoring.pendingWarning);
  const isOpen = Boolean(pendingWarning);

  if (!pendingWarning) {
    return null;
  }

  return (
    <CreateModal
      open={isOpen}
      onClose={() => {}}
      maxWidthClassName="max-w-[460px]"
      panelClassName="p-6 sm:p-7"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEF0C7] text-[#DC6803]">
            <ImportantIconSvg />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[24px] font-[600] leading-7 tracking-[-0.04em] text-[#232A25]">Warning!</p>
            <p className="text-[14px] leading-5 text-[#747775]">Suspicious activity detected.</p>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#FEDF89] bg-[#FFFAEB] p-4">
          <p className="text-[14px] leading-5 text-[#232A25]">{pendingWarning.message}</p>
          <p className="mt-2 text-[14px] font-[600] leading-5 text-[#B54708]">
            Current flag count: {pendingWarning.flagCount}
          </p>
        </div>

        <p className="text-[14px] leading-5 text-[#747775]">Please continue carefully.</p>

        <button
          type="button"
          onClick={() => dispatch(dismissProctoringWarning())}
          className="h-11 rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
        >
          I Understand
        </button>
      </div>
    </CreateModal>
  );
};

export default ProctoringWarningModal;
