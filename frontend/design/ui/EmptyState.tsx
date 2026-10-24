import type { ReactNode } from "react";
import { cn } from "./cn";
import { InboxIcon } from "./icons";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** One next step, usually a primary Button ("Create your first class"). */
  action?: ReactNode;
  /** An illustration or icon; defaults to an inbox. */
  icon?: ReactNode;
  className?: string;
}

/** What a list or page shows when it has nothing yet, and the one thing to do about it. */
const EmptyState = ({ title, description, action, icon, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 px-4 py-10 text-center", className)}>
    <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
      {icon ?? <InboxIcon className="size-6" />}
    </span>
    <div className="flex max-w-md flex-col gap-1">
      <p className="text-body font-semibold text-ink">{title}</p>
      {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
    </div>
    {action ? <div className="mt-1">{action}</div> : null}
  </div>
);

export default EmptyState;
