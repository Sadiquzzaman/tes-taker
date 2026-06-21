"use client";

import { getProctoringFlagColorStyles } from "@/utils/tests/proctoring";
import { memo } from "react";

interface ProctoringFlagBadgeProps {
  flagCount: number;
  label?: string;
  className?: string;
}

const ProctoringFlagBadge = ({ flagCount, label = "Flag Count", className = "" }: ProctoringFlagBadgeProps) => {
  const colors = getProctoringFlagColorStyles(flagCount);

  return (
    <div
      className={`rounded-[10px] px-4 py-3 ${className}`}
      style={{ backgroundColor: colors.background, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      <p className="text-[12px] font-[500] leading-4 opacity-90">{label}</p>
      <p className="mt-1 text-[32px] font-[700] leading-8">{flagCount}</p>
    </div>
  );
};

export default memo(ProctoringFlagBadge);
