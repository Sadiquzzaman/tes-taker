import type { ReactNode } from "react";
import { cn } from "./cn";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** A Breadcrumb above the title, for detail pages. */
  breadcrumb?: ReactNode;
  /** The page's main actions (primary button last). They wrap under the title on phones. */
  actions?: ReactNode;
  className?: string;
}

/** The top of a page: where you are, what this page is, and what you can do here. */
const PageHeader = ({ title, description, breadcrumb, actions, className }: PageHeaderProps) => (
  <div className={cn("flex flex-col gap-3", className)}>
    {breadcrumb}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  </div>
);

export default PageHeader;
