import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-ink-muted",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** A coloured dot before the text: use it for statuses (StatusPill). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/** A short label or status. The colour must never be the only signal: the text says the status too. */
const Badge = ({ tone = "neutral", dot = false, className, children }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-medium",
      TONES[tone],
      className,
    )}
  >
    {dot ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOTS[tone])} /> : null}
    <span className="truncate">{children}</span>
  </span>
);

/** A Badge with a dot, for live states such as "Live", "Scheduled", "Absent". */
export const StatusPill = (props: Omit<BadgeProps, "dot">) => <Badge dot {...props} />;

export default Badge;
