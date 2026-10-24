"use client";

import ProctoringFlagListModal from "@/component/Tests/exam/ProctoringFlagListModal";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";
import { useTranslations } from "next-intl";

const ProctoringPanel = ({ mediaStream, onRetry, connectionError }: ProctoringPanelProps) => {
  const { permissionError, statusText } = useAppSelector(selectProctoringPanelState);
  const t = useTranslations("proctoring");

  const handleEnterFullscreen = async () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <aside className="fixed bottom-4 right-4 z-20 hidden w-[220px] overflow-hidden rounded-input border border-border bg-surface shadow-lg md:block xl:hidden">
      <ProctoringVideoPreview mediaStream={mediaStream} className="h-[124px] w-full bg-ink object-cover" />

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-body-sm font-semibold leading-4 text-ink">{t("title")}</p>
          <span className="rounded-input bg-primary-soft px-2 py-1 text-caption font-medium leading-3 text-primary">
            {t(`status.${statusText}`)}
          </span>
        </div>

        <ProctoringFlagListModal />

        {permissionError ? <p className="text-caption leading-4 text-danger">{permissionError}</p> : null}
        {connectionError ? <p className="text-caption leading-4 text-danger">{connectionError}</p> : null}

        <div className="flex gap-2">
          {permissionError ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-8 flex-1 rounded-input bg-primary px-3 text-caption font-medium leading-4 text-ink-inverse"
            >
              {t("retry")}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void handleEnterFullscreen()}
            className="h-8 flex-1 rounded-input border border-border px-3 text-caption font-medium leading-4 text-ink"
          >
            {t("fullscreen")}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ProctoringPanel;
