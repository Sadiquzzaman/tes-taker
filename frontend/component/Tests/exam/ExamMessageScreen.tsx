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
  neutral: "bg-[#EFF0F3] text-[#232A25]",
  warning: "bg-[#FEE4E2] text-[#D92D20]",
  success: "bg-[#EAF2EB] text-[#49734F]",
};

const ExamMessageScreen = ({ variant, reason, onAction, actionLabel }: ExamMessageScreenProps) => {
  const t = useTranslations("exam");
  const tone = MESSAGE_TONE[variant];
  const defaultActionLabel = t("backToTests");

  return (
    <CreateModal open onClose={() => {}} maxWidthClassName="max-w-[520px]" panelClassName="p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={`flex size-14 items-center justify-center rounded-full text-[24px] font-[700] ${toneStyles[tone]}`}
        >
          !
        </div>
        <p className="text-[24px] font-[600] leading-7 tracking-[-0.04em] text-[#232A25]">{t(`message.${variant}.title`)}</p>
        <p className="text-[14px] leading-6 text-[#747775]">{t(`message.${variant}.description`)}</p>
        {reason ? <p className="text-[13px] leading-5 text-[#B93815]">{reason}</p> : null}
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 h-11 rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
          >
            {actionLabel ?? defaultActionLabel}
          </button>
        ) : (
          <Link
            href="/classes"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
          >
            {actionLabel ?? defaultActionLabel}
          </Link>
        )}
      </div>
    </CreateModal>
  );
};

export default ExamMessageScreen;
