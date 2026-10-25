"use client";

import ProctoringFlagBadge from "@/component/Tests/exam/ProctoringFlagBadge";
import ProctoringMonitoringLog from "@/component/Tests/exam/ProctoringMonitoringLog";
import ProctoringVideoPreview from "@/component/Tests/exam/ProctoringVideoPreview";
import { selectProctoringPanelState } from "@/lib/features/proctoringSlice";
import { useAppSelector } from "@/lib/hooks";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface ProctoringSidebarProps {
  mediaStream: MediaStream | null;
}

const ProctoringSidebar = ({ mediaStream }: ProctoringSidebarProps) => {
  const { flagCount, riskLevel, flags } = useAppSelector(selectProctoringPanelState);
  const t = useTranslations("proctoring.risk");

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-4 border-l border-border bg-canvas p-4 xl:flex">
      <ProctoringVideoPreview mediaStream={mediaStream} />

      <div className="grid grid-cols-2 gap-3">
        <ProctoringFlagBadge flagCount={flagCount} />
        <div className="rounded-card border border-border bg-surface px-4 py-3">
          <p className="text-caption font-medium leading-4 text-ink-muted">{t("label")}</p>
          <p className="mt-1 text-body font-semibold leading-5 text-ink">{t(riskLevel)}</p>
        </div>
      </div>

      <ProctoringMonitoringLog flags={flags} />
    </aside>
  );
};

export default memo(ProctoringSidebar);
