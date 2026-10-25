"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/design/ui";
import ExamDialog from "./ExamDialog";

export type ExamMessageVariant =
  | "not-started"
  | "exam-ended"
  | "already-submitted"
  | "disqualified"
  | "time-up"
  | "not-assigned"
  | "exam-full";

interface ExamMessageScreenProps {
  variant: ExamMessageVariant;
  reason?: string | null;
  onAction?: () => void;
  actionLabel?: string;
}

const TONE: Record<ExamMessageVariant, "neutral" | "warning" | "success" | "info"> = {
  "not-started": "info",
  "exam-ended": "warning",
  "already-submitted": "success",
  disqualified: "warning",
  "time-up": "warning",
  "not-assigned": "neutral",
  "exam-full": "neutral",
};

/** Why the student cannot (or no longer) take the exam, with the way back. */
const ExamMessageScreen = ({ variant, reason, onAction, actionLabel }: ExamMessageScreenProps) => {
  const t = useTranslations("exam");
  const label = actionLabel ?? t("backToTests");

  return (
    <ExamDialog
      open
      tone={TONE[variant]}
      title={t(`message.${variant}.title`)}
      description={t(`message.${variant}.description`)}
      footer={
        onAction ? (
          <Button onClick={onAction}>{label}</Button>
        ) : (
          <NextLink href="/classes" className={buttonClasses()}>
            {label}
          </NextLink>
        )
      }
    >
      {reason ? <p className="text-body-sm text-danger">{reason}</p> : null}
    </ExamDialog>
  );
};

export default ExamMessageScreen;
