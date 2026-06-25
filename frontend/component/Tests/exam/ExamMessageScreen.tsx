"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import Link from "next/link";

export type ExamMessageVariant =
  | "not-started"
  | "exam-ended"
  | "already-submitted"
  | "disqualified"
  | "time-up"
  | "not-assigned";

interface ExamMessageScreenProps {
  variant: ExamMessageVariant;
  reason?: string | null;
  onAction?: () => void;
  actionLabel?: string;
}

const MESSAGE_COPY: Record<
  ExamMessageVariant,
  { title: string; description: string; actionLabel: string; tone: "neutral" | "warning" | "success" }
> = {
  "not-started": {
    title: "Exam has not started",
    description: "This exam is not open yet. Please return when the scheduled start time arrives.",
    actionLabel: "Back to Tests",
    tone: "neutral",
  },
  "exam-ended": {
    title: "Exam has ended",
    description: "The exam window is closed. You can no longer enter or submit this test.",
    actionLabel: "Back to Tests",
    tone: "warning",
  },
  "already-submitted": {
    title: "Already submitted",
    description: "You have already submitted this exam and cannot rejoin it.",
    actionLabel: "Back to Tests",
    tone: "success",
  },
  disqualified: {
    title: "Exam ended",
    description: "Your session was disqualified. Your answers have been recorded.",
    actionLabel: "Back to Tests",
    tone: "warning",
  },
  "time-up": {
    title: "Time is up",
    description: "Your exam time has ended and your answers were submitted automatically.",
    actionLabel: "Back to Tests",
    tone: "warning",
  },
  "not-assigned": {
    title: "Access denied",
    description: "You are not assigned to this exam.",
    actionLabel: "Back to Tests",
    tone: "neutral",
  },
};

const toneStyles = {
  neutral: "bg-[#EFF0F3] text-[#232A25]",
  warning: "bg-[#FEE4E2] text-[#D92D20]",
  success: "bg-[#EAF2EB] text-[#49734F]",
};

const ExamMessageScreen = ({ variant, reason, onAction, actionLabel }: ExamMessageScreenProps) => {
  const copy = MESSAGE_COPY[variant];

  return (
    <CreateModal open onClose={() => {}} maxWidthClassName="max-w-[520px]" panelClassName="p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={`flex size-14 items-center justify-center rounded-full text-[24px] font-[700] ${toneStyles[copy.tone]}`}
        >
          !
        </div>
        <p className="text-[24px] font-[600] leading-7 tracking-[-0.04em] text-[#232A25]">{copy.title}</p>
        <p className="text-[14px] leading-6 text-[#747775]">{copy.description}</p>
        {reason ? <p className="text-[13px] leading-5 text-[#B93815]">{reason}</p> : null}
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 h-11 rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
          >
            {actionLabel ?? copy.actionLabel}
          </button>
        ) : (
          <Link
            href="/classes"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
          >
            {actionLabel ?? copy.actionLabel}
          </Link>
        )}
      </div>
    </CreateModal>
  );
};

export default ExamMessageScreen;
