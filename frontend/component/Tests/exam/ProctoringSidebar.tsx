"use client";

import ProctoringFlagBadge from "@/component/Tests/exam/ProctoringFlagBadge";
import ProctoringMonitoringLog from "@/component/Tests/exam/ProctoringMonitoringLog";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";
import { memo } from "react";

interface ProctoringSidebarProps {
  mediaStream: MediaStream | null;
}

const ProctoringSidebar = ({ mediaStream }: ProctoringSidebarProps) => {
  const { flagCount, riskLevel, flags } = useAppSelector(selectProctoringPanelState);

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-4 border-l border-[#E5E5E5] bg-[#FAFBFA] p-4 xl:flex">
      <ProctoringVideoPreview mediaStream={mediaStream} />

      <div className="grid grid-cols-2 gap-3">
        <ProctoringFlagBadge flagCount={flagCount} />
        <div className="rounded-[10px] border border-[#E6ECE7] bg-white px-4 py-3">
          <p className="text-[12px] font-[500] leading-4 text-[#747775]">Risk Level</p>
          <p className="mt-1 text-[16px] font-[600] leading-5 text-[#232A25]">{riskLevel}</p>
        </div>
      </div>

      <ProctoringMonitoringLog flags={flags} />
    </aside>
  );
};

export default memo(ProctoringSidebar);
