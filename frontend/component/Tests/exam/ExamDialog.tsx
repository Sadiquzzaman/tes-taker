"use client";

import type { ReactNode } from "react";
import { cn, Modal } from "@/design/ui";
import { AlertIcon, CheckIcon } from "@/design/ui/icons";

const TONES = {
  neutral: "bg-canvas text-ink",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
} as const;

/**
 * A dialog the student must act on during the exam (it cannot be dismissed with Esc or a click
 * outside): an icon in the tone's colour, a title, a short explanation and the action.
 */
const ExamDialog = ({
  open,
  tone = "neutral",
  title,
  description,
  children,
  footer,
  icon,
}: {
  open: boolean;
  tone?: keyof typeof TONES;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
}) => (
  <Modal
    open={open}
    onClose={() => {}}
    dismissible={false}
    hideClose
    size="sm"
    title={
      <span className="flex items-center gap-3">
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full", TONES[tone])}>
          {icon ?? (tone === "success" ? <CheckIcon className="size-5" /> : <AlertIcon className="size-5" />)}
        </span>
        {title}
      </span>
    }
    description={description}
    footer={footer}
  >
    {children}
  </Modal>
);

export default ExamDialog;
