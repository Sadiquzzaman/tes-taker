"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { useAppSelector } from "@/lib/hooks";

const ProctoringCountdownModal = () => {
  const activeCountdown = useAppSelector((state) => state.proctoring.activeCountdown);

  if (!activeCountdown) {
    return null;
  }

  const title =
    activeCountdown.type === "screen-share" ? "Screen Share Required" : "Multiple Displays Detected";

  return (
    <CreateModal
      open
      onClose={() => {}}
      maxWidthClassName="max-w-[460px]"
      panelClassName="p-6 sm:p-7"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[24px] font-[600] leading-7 tracking-[-0.04em] text-[#232A25]">{title}</p>
        <div className="flex size-24 items-center justify-center rounded-full border-4 border-[#F79009] text-[32px] font-[700] text-[#F79009]">
          {activeCountdown.secondsRemaining}
        </div>
        <p className="text-[14px] leading-6 text-[#747775]">{activeCountdown.message}</p>
        <p className="text-[13px] leading-5 text-[#B54708]">
          Resolve this within {activeCountdown.secondsRemaining} seconds to avoid disqualification.
        </p>
      </div>
    </CreateModal>
  );
};

export default ProctoringCountdownModal;
