"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import ProctoringFlagBadge from "@/component/Tests/exam/ProctoringFlagBadge";
import ProctoringMonitoringLog from "@/component/Tests/exam/ProctoringMonitoringLog";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";
import { getProctoringFlagColorStyles } from "@/utils/tests/proctoring";
import { memo, useState } from "react";

interface ProctoringMobileFabProps {
  mediaStream: MediaStream | null;
}

const ProctoringMobileFab = ({ mediaStream }: ProctoringMobileFabProps) => {
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const { flagCount, riskLevel, flags } = useAppSelector(selectProctoringPanelState);
  const fabColors = getProctoringFlagColorStyles(flagCount);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsBoardOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-full shadow-lg xl:hidden"
        style={{ backgroundColor: fabColors.background, color: fabColors.text }}
        aria-label="Open transparency board"
      >
        <span className="relative text-[20px] font-[700]">
          {flagCount > 0 ? (
            <span className="absolute -right-3 -top-3 flex size-5 items-center justify-center rounded-full bg-[#D92D20] text-[10px] text-white">
              {flagCount}
            </span>
          ) : null}
          ●
        </span>
      </button>

      <CreateModal
        open={isBoardOpen}
        onClose={() => setIsBoardOpen(false)}
        maxWidthClassName="max-w-[420px]"
        panelClassName="p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[20px] font-[600] leading-6 text-[#232A25]">Transparency Board</p>
            <button
              type="button"
              onClick={() => setIsBoardOpen(false)}
              className="rounded-[8px] border border-[#DDE5DE] px-3 py-1.5 text-[12px] font-[500] text-[#232A25]"
            >
              Close
            </button>
          </div>

          <p className="text-[12px] leading-4 text-[#747775]">N.B. This camera view is only for your own monitor.</p>

          <ProctoringVideoPreview
            mediaStream={mediaStream}
            className="h-[140px] w-full rounded-[10px] bg-[#0F1A12] object-cover"
          />

          <ProctoringFlagBadge flagCount={flagCount} label="Flagged count" />

          <div className="rounded-[10px] border border-[#E6ECE7] bg-white px-4 py-3">
            <p className="text-[12px] font-[500] leading-4 text-[#747775]">Risk Level</p>
            <p className="mt-1 text-[16px] font-[600] leading-5 text-[#232A25]">{riskLevel}</p>
          </div>

          <ProctoringMonitoringLog flags={flags} />
        </div>
      </CreateModal>
    </>
  );
};

export default memo(ProctoringMobileFab);
