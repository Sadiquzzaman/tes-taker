"use client";

import { getProctoringFlagColorStyles } from "@/utils/tests/proctoring";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface ProctoringFlagBadgeProps {
  flagCount: number;
  label?: string;
  className?: string;
}

const ProctoringFlagBadge = ({ flagCount, label, className = "" }: ProctoringFlagBadgeProps) => {
  const t = useTranslations("proctoring");
  const colors = getProctoringFlagColorStyles(flagCount);

  return (
    <div
      className={`rounded-card px-4 py-3 ${className}`}
      style={{ backgroundColor: colors.background, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      <p className="text-caption font-medium leading-4 opacity-90">{label ?? t("flagCount")}</p>
      <p className="mt-1 text-display font-bold leading-8">{flagCount}</p>
    </div>
  );
};

export default memo(ProctoringFlagBadge);
