"use client";

import { useTranslations } from "next-intl";
import { memo } from "react";

interface ProctoringMonitoringLogProps {
  flags: ProctoringFlag[];
  className?: string;
}

const ProctoringMonitoringLog = ({ flags, className = "" }: ProctoringMonitoringLogProps) => {
  const t = useTranslations("proctoring");
  const recentFlags = [...flags].reverse().slice(0, 6);

  return (
    <div className={`rounded-card border border-border bg-surface p-3 ${className}`}>
      <p className="text-body-sm font-semibold leading-4 text-ink">{t("monitoring")}</p>
      <ul className="mt-3 flex max-h-[180px] flex-col gap-2 overflow-y-auto">
        {recentFlags.length > 0 ? (
          recentFlags.map((flag) => (
            <li key={flag.id} className="rounded-input bg-primary-soft px-3 py-2 text-caption leading-4 text-primary">
              {t(`flags.${flag.type}`)}
            </li>
          ))
        ) : (
          <li className="px-1 py-2 text-caption leading-4 text-ink-muted">{t("noViolations")}</li>
        )}
      </ul>
    </div>
  );
};

export default memo(ProctoringMonitoringLog);
