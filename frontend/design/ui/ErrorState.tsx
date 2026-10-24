"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Button from "./Button";
import { cn } from "./cn";
import { AlertIcon } from "./icons";

export interface ErrorStateProps {
  /** Defaults to "Something went wrong". */
  title?: ReactNode;
  /** What failed, in plain words. */
  description?: ReactNode;
  /** Shows a "Try again" button. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** Shown in place of content that failed to load, with a way to try again. */
const ErrorState = ({ title, description, onRetry, retrying = false, className }: ErrorStateProps) => {
  const t = useTranslations("ui.error");

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 px-4 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertIcon className="size-6" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-body font-semibold text-ink">{title ?? t("title")}</p>
        {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} loading={retrying}>
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
};

export default ErrorState;
