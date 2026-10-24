"use client";

import { Sheet } from "@/design/ui";
import ProctoringFlagBadge from "@/component/Tests/exam/ProctoringFlagBadge";
import ProctoringMonitoringLog from "@/component/Tests/exam/ProctoringMonitoringLog";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";
import { getProctoringFlagToneClasses } from "@/utils/tests/proctoring";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

interface ProctoringMobileFabProps {
  mediaStream: MediaStream | null;
}

const ProctoringMobileFab = ({ mediaStream }: ProctoringMobileFabProps) => {
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const { flagCount, riskLevel, flags } = useAppSelector(selectProctoringPanelState);
  const fabTone = getProctoringFlagToneClasses(flagCount);
  const t = useTranslations("proctoring");

  return (
    <>
      <button
        type="button"
        onClick={() => setIsBoardOpen(true)}
        className={`fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-full shadow-overlay xl:hidden ${fabTone}`}
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

      <Sheet open={isBoardOpen} onClose={() => setIsBoardOpen(false)} title={t("board")}>
        <div className="flex flex-col gap-4">

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
      </Sheet>
    </>
  );
};

export default memo(ProctoringMobileFab);
