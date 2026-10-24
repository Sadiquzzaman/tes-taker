"use client";

import { getProctoringFlagToneClasses } from "@/utils/tests/proctoring";
import { useTranslations } from "next-intl";
import { memo } from "react";
import useFormat from "@/i18n/useFormat";

interface ProctoringFlagBadgeProps {
  flagCount: number;
  label?: string;
  className?: string;
}

const ProctoringFlagBadge = ({ flagCount, label, className = "" }: ProctoringFlagBadgeProps) => {
  const t = useTranslations("proctoring");
  const tone = getProctoringFlagToneClasses(flagCount);
  const format = useFormat();

  return (
    <div
      className={`rounded-card border px-4 py-3 ${tone} ${className}`}
    >
      <p className="text-caption font-medium opacity-90">{label ?? t("flagCount")}</p>
      <p className="mt-1 text-title font-bold">{format.number(flagCount)}</p>
    </div>
  );
};

export default memo(ProctoringFlagBadge);
