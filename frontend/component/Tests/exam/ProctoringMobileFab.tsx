"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import ProctoringFlagBadge from "@/component/Tests/exam/ProctoringFlagBadge";
import ProctoringMonitoringLog from "@/component/Tests/exam/ProctoringMonitoringLog";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";
import { getProctoringFlagColorStyles } from "@/utils/tests/proctoring";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

interface ProctoringMobileFabProps {
  mediaStream: MediaStream | null;
}

const ProctoringMobileFab = ({ mediaStream }: ProctoringMobileFabProps) => {
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const { flagCount, riskLevel, flags } = useAppSelector(selectProctoringPanelState);
  const fabColors = getProctoringFlagColorStyles(flagCount);
  const t = useTranslations("proctoring");

  return (
    <>
      <button
        type="button"
        onClick={() => setIsBoardOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-full shadow-lg xl:hidden"
        style={{ backgroundColor: fabColors.background, color: fabColors.text }}
        aria-label={t("openBoard")}
      >
        <span className="relative text-title-sm font-bold">
          {flagCount > 0 ? (
            <span className="absolute -right-3 -top-3 flex size-5 items-center justify-center rounded-full bg-danger text-caption text-ink-inverse">
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
            <p className="text-title-sm font-semibold leading-6 text-ink">{t("board")}</p>
            <button
              type="button"
              onClick={() => setIsBoardOpen(false)}
              className="rounded-input border border-border px-3 py-1.5 text-caption font-medium text-ink"
            >
              {t("close")}
            </button>
          </div>

          <p className="text-caption leading-4 text-ink-muted">{t("ownViewNote")}</p>

          <ProctoringVideoPreview
            mediaStream={mediaStream}
            className="h-[140px] w-full rounded-card bg-ink object-cover"
          />

          <ProctoringFlagBadge flagCount={flagCount} label={t("flaggedCount")} />

          <div className="rounded-card border border-border bg-surface px-4 py-3">
            <p className="text-caption font-medium leading-4 text-ink-muted">{t("risk.label")}</p>
            <p className="mt-1 text-body font-semibold leading-5 text-ink">{t(`risk.${riskLevel}`)}</p>
          </div>

          <ProctoringMonitoringLog flags={flags} />
        </div>
      </CreateModal>
    </>
  );
};

export default memo(ProctoringMobileFab);
