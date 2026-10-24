"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/design/ui";
import { dismissProctoringWarning } from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import ExamDialog from "./ExamDialog";

/** One plain sentence about what was flagged, the flag count, and "I understand" (review §4.6). */
const ProctoringWarningModal = () => {
  const t = useTranslations("proctoring");
  const dispatch = useAppDispatch();
  const pendingWarning = useAppSelector((state) => state.proctoring.pendingWarning);

  if (!pendingWarning) {
    return null;
  }

  return (
    <ExamDialog
      open
      tone="warning"
      title={t("warningTitle")}
      description={t(`flags.${pendingWarning.type}`)}
      footer={<Button onClick={() => dispatch(dismissProctoringWarning())}>{t("understand")}</Button>}
    >
      <div className="flex flex-col gap-1 text-body-sm">
        <p className="font-medium text-warning">{t("currentFlagCount", { count: pendingWarning.flagCount })}</p>
        <p className="text-ink-muted">{t("continueCarefully")}</p>
      </div>
    </ExamDialog>
  );
};

export default ProctoringWarningModal;
