"use client";

import { useTranslations } from "next-intl";
import { cn, Spinner } from "@/design/ui";

/** A centred spinner with a screen-reader label, for the exam pages while they load. */
const ExamLoading = ({ className }: { className?: string }) => {
  const t = useTranslations("ui");

  return (
    <div role="status" className={cn("flex w-full flex-1 items-center justify-center py-16 text-primary", className)}>
      <Spinner className="size-10" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
};

export default ExamLoading;
