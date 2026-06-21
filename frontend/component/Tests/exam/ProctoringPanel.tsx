"use client";

import ProctoringFlagListModal from "@/component/Tests/exam/ProctoringFlagListModal";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";

const ProctoringPanel = ({ mediaStream, onRetry, connectionError }: ProctoringPanelProps) => {
  const { permissionError, statusText } = useAppSelector(selectProctoringPanelState);

  const handleEnterFullscreen = async () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <aside className="fixed bottom-4 right-4 z-20 hidden w-[220px] overflow-hidden rounded-[8px] border border-[#DDE5DE] bg-white shadow-lg md:block xl:hidden">
      <ProctoringVideoPreview mediaStream={mediaStream} className="h-[124px] w-full bg-[#0F1A12] object-cover" />

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-[600] leading-4 text-[#232A25]">Proctoring</p>
          <span className="rounded-[6px] bg-[#EDF4EE] px-2 py-1 text-[12px] font-[500] leading-3 text-[#49734F]">
            {statusText}
          </span>
        </div>

        <ProctoringFlagListModal />

        {permissionError ? <p className="text-[12px] leading-4 text-[#B93815]">{permissionError}</p> : null}
        {connectionError ? <p className="text-[12px] leading-4 text-[#B93815]">{connectionError}</p> : null}

        <div className="flex gap-2">
          {permissionError ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-8 flex-1 rounded-[8px] bg-[#49734F] px-3 text-[12px] font-[500] leading-4 text-white"
            >
              Retry
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void handleEnterFullscreen()}
            className="h-8 flex-1 rounded-[8px] border border-[#DDE5DE] px-3 text-[12px] font-[500] leading-4 text-[#232A25]"
          >
            Fullscreen
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ProctoringPanel;
