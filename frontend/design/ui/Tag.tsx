"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn, focusRing } from "./cn";
import { CloseIcon } from "./icons";

export interface TagProps {
  children: ReactNode;
  /** Shows a remove button. `label` is used for its screen-reader name. */
  onRemove?: () => void;
  label?: string;
  className?: string;
}

/** A chip for a chosen value (a subject, a class, a filter). */
const Tag = ({ children, onRemove, label, className }: TagProps) => {
  const t = useTranslations("ui");

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-input border border-border bg-canvas py-0.5 pl-2 text-body-sm text-ink",
        onRemove ? "pr-0.5" : "pr-2",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("removeTag", { label: label ?? (typeof children === "string" ? children : "") })}
          className={cn("inline-flex size-5 items-center justify-center rounded-sm text-ink-muted hover:bg-border hover:text-ink", focusRing)}
        >
          <CloseIcon className="size-3" />
        </button>
      ) : null}
    </span>
  );
};

export default Tag;
