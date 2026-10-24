"use client";

import { useTranslations } from "next-intl";
import ExamDialog from "./ExamDialog";

interface ProctoringDisqualificationScreenProps {
  open: boolean;
  reason?: string | null;
}

/** Shown once the student has too many proctoring flags; their answers are submitted. */
const ProctoringDisqualificationScreen = ({ open, reason }: ProctoringDisqualificationScreenProps) => {
  const t = useTranslations("proctoring");

  if (!open) {
    return null;
  }

  return (
    <ExamDialog open tone="danger" title={t("disqualifiedTitle")} description={t("disqualifiedDescription")}>
      {reason ? <p className="text-body-sm text-danger">{reason}</p> : null}
    </ExamDialog>
  );
};

export default ProctoringDisqualificationScreen;
