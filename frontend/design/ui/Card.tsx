import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons or links on the right of the header. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Remove the body padding (for tables and lists that run edge to edge). */
  flush?: boolean;
  as?: "section" | "article" | "div";
}

/** A white panel with an optional header and footer. The basic building block of every page. */
const Card = ({ title, description, actions, footer, flush = false, as: Tag = "section", className, children, ...rest }: CardProps) => (
  <Tag className={cn("flex flex-col rounded-card border border-border bg-surface shadow-card", className)} {...rest}>
    {title || actions ? (
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          {title ? <h2 className="text-title-sm font-semibold text-ink">{title}</h2> : null}
          {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
    ) : null}
    <div className={cn("flex-1", !flush && "p-4 sm:p-5")}>{children}</div>
    {footer ? <footer className="border-t border-border px-4 py-3 sm:px-5">{footer}</footer> : null}
  </Tag>
);

export default Card;
