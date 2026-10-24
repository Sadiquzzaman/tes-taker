"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "./cn";
import IconButton from "./IconButton";
import { AlertIcon, CheckIcon, CloseIcon } from "./icons";

export type ToastTone = "success" | "error" | "warning" | "info";

const TONES: Record<ToastTone, { box: string; icon: string }> = {
  success: { box: "border-success/30", icon: "bg-success-soft text-success" },
  error: { box: "border-danger/30", icon: "bg-danger-soft text-danger" },
  warning: { box: "border-warning/30", icon: "bg-warning-soft text-warning" },
  info: { box: "border-info/30", icon: "bg-info-soft text-info" },
};

export interface ToastProps {
  title?: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  onClose: () => void;
}

/** One notification card. Shown by `useToast().triggerToast(...)` (component/Toast/ToastContext). */
const Toast = ({ title, description, tone = "info", onClose }: ToastProps) => {
  const t = useTranslations("ui");

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-card border bg-surface p-3 shadow-overlay",
        "motion-safe:animate-[toast-in_var(--motion-sheet)_ease-out]",
        TONES[tone].box,
      )}
    >
      <span className={cn("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full", TONES[tone].icon)}>
        {tone === "success" ? <CheckIcon className="size-3.5" /> : <AlertIcon className="size-3.5" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="text-body-sm font-semibold text-ink">{title}</p> : null}
        {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      <IconButton size="sm" label={t("close")} icon={<CloseIcon />} onClick={onClose} />
    </div>
  );
};

/** Where toasts stack: top right on desktop, top and full width on phones. */
export const ToastRegion = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-96">{children}</div>
);

export default Toast;
