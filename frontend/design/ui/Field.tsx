"use client";

import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface FieldProps {
  label?: ReactNode;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Error text; also marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Hide the label visually but keep it for screen readers (e.g. a search box with a placeholder). */
  hideLabel?: boolean;
  className?: string;
  /** Renders the control with the ids it must use. */
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label, control, hint and error, wired together with ids for screen readers. Used by every input. */
const Field = ({ label, hint, error, required, hideLabel, className, children }: FieldProps) => {
  const t = useTranslations("ui");
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className={cn("text-body-sm font-medium text-ink", hideLabel && "sr-only")}>
          {label}
          {required ? (
            <span className="text-danger">
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> ({t("required")})</span>
            </span>
          ) : null}
        </label>
      ) : null}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default Field;

/** Shared look of text-like controls (input, textarea, select). */
export const controlClasses = (invalid: boolean, className?: string) =>
  cn(
    "w-full rounded-input border bg-surface px-3 text-body text-ink placeholder:text-ink-muted",
    "transition-colors duration-(--motion-fast) ease-fast outline-none",
    "focus-visible:ring-2 focus-visible:ring-offset-0",
    "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted",
    invalid ? "border-danger focus-visible:ring-danger" : "border-border hover:border-ink-muted focus-visible:ring-primary",
    className,
  );
