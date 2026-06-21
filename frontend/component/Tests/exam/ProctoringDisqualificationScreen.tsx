"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { DISQUALIFICATION_MESSAGE } from "@/utils/tests/proctoring";

interface ProctoringDisqualificationScreenProps {
  open: boolean;
  reason?: string | null;
}

const ProctoringDisqualificationScreen = ({ open, reason }: ProctoringDisqualificationScreenProps) => {
  if (!open) {
    return null;
  }

  return (
    <CreateModal
      open={open}
      onClose={() => {}}
      maxWidthClassName="max-w-[520px]"
      panelClassName="p-6 sm:p-8"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-[#FEE4E2] text-[#D92D20]">
          <span className="text-[24px] font-[700]">!</span>
        </div>
        <p className="text-[24px] font-[600] leading-7 tracking-[-0.04em] text-[#232A25]">Disqualified</p>
        <p className="text-[14px] leading-6 text-[#747775]">{DISQUALIFICATION_MESSAGE}</p>
        {reason ? <p className="text-[13px] leading-5 text-[#B93815]">{reason}</p> : null}
      </div>
    </CreateModal>
  );
};

export default ProctoringDisqualificationScreen;
