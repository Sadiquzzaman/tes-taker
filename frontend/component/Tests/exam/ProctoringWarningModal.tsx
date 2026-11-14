"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { dismissProctoringWarning } from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import ExamDialog from "./ExamDialog";

/** The warning closes on its own after this long, so it never holds up the exam. */
export const WARNING_AUTO_CLOSE_MS = 1000;

/**
 * One plain sentence about what was flagged and the flag count (review §4.6). It closes with the
 * × at once, or on its own after 1 second; a new flag shows again for its own second.
 */
const ProctoringWarningModal = () => {
  const t = useTranslations("proctoring");
  const dispatch = useAppDispatch();
  const pendingWarning = useAppSelector((state) => state.proctoring.pendingWarning);
  const flagCount = pendingWarning?.flagCount ?? 0;

  useEffect(() => {
    if (!flagCount) return;
    const timer = window.setTimeout(() => dispatch(dismissProctoringWarning()), WARNING_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [dispatch, flagCount]);

  if (!pendingWarning) {
    return null;
  }

  return (
    <ExamDialog
      open
      tone="warning"
      title={t("warningTitle")}
      description={t(`flags.${pendingWarning.type}`)}
      onClose={() => dispatch(dismissProctoringWarning())}
    >
      <div className="flex flex-col gap-1 text-body-sm">
        <p className="font-medium text-warning">{t("currentFlagCount", { count: pendingWarning.flagCount })}</p>
        {pendingWarning.limit ? (
          <p role="alert" className="font-medium text-danger">
            {t("limitWarning", { count: pendingWarning.limit.count, total: pendingWarning.limit.threshold })}
          </p>
        ) : null}
        <p className="text-ink-muted">{t("continueCarefully")}</p>
      </div>
    </ExamDialog>
  );
};

export default ProctoringWarningModal;
