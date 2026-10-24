"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { useTranslations } from "next-intl";
import Link from "next/link";

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

const MESSAGE_TONE: Record<ExamMessageVariant, "neutral" | "warning" | "success"> = {
  "not-started": "neutral",
  "exam-ended": "warning",
  "already-submitted": "success",
  disqualified: "warning",
  "time-up": "warning",
  "not-assigned": "neutral",
  "exam-full": "neutral",
};

const toneStyles = {
  neutral: "bg-canvas text-ink",
  warning: "bg-danger-soft text-danger",
  success: "bg-primary-soft text-primary",
};

const ExamMessageScreen = ({ variant, reason, onAction, actionLabel }: ExamMessageScreenProps) => {
  const t = useTranslations("exam");
  const tone = MESSAGE_TONE[variant];
  const defaultActionLabel = t("backToTests");

  return (
    <CreateModal open onClose={() => {}} maxWidthClassName="max-w-[520px]" panelClassName="p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={`flex size-14 items-center justify-center rounded-full text-title font-bold ${toneStyles[tone]}`}
        >
          !
        </div>
        <p className="text-title font-semibold leading-7 tracking-tight text-ink">{t(`message.${variant}.title`)}</p>
        <p className="text-body-sm leading-6 text-ink-muted">{t(`message.${variant}.description`)}</p>
        {reason ? <p className="text-body-sm leading-5 text-danger">{reason}</p> : null}
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 h-11 rounded-card bg-primary px-5 text-body-sm font-semibold leading-4 text-ink-inverse"
          >
            {actionLabel ?? defaultActionLabel}
          </button>
        ) : (
          <Link
            href="/classes"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-card bg-primary px-5 text-body-sm font-semibold leading-4 text-ink-inverse"
          >
            {actionLabel ?? defaultActionLabel}
          </Link>
        )}
      </div>
    </CreateModal>
  );
};

export default ExamMessageScreen;
