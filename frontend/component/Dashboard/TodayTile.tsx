import NextLink from "next/link";
import type { ReactNode } from "react";
import { buttonClasses, cn, Skeleton } from "@/design/ui";

export interface TodayTileProps {
  label: ReactNode;
  /** The big number or name. */
  value?: ReactNode;
  detail?: ReactNode;
  /** The one thing to do next. */
  action?: { label: string; href: string };
  /** Extra controls in the header (e.g. previous/next). */
  headerExtra?: ReactNode;
  /** Highlight the tile when something needs doing. */
  emphasis?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

/** One tile of the "Today" strip: what needs action now, and a link to act on it. */
const TodayTile = ({ label, value, detail, action, headerExtra, emphasis = false, loading = false, children }: TodayTileProps) => (
  <section
    aria-busy={loading || undefined}
    className={cn(
      "flex min-h-40 flex-col gap-3 rounded-card border p-4 shadow-card",
      emphasis ? "border-primary bg-primary text-ink-inverse" : "border-border bg-surface text-ink",
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <h2 className={cn("text-body-sm font-medium", emphasis ? "text-ink-inverse" : "text-ink-muted")}>{label}</h2>
      {headerExtra}
    </div>
    {loading ? (
      <Skeleton lines={3} className="mt-1" />
    ) : (
      <>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {value !== undefined ? <p className="truncate text-title font-semibold">{value}</p> : null}
          {detail ? (
            <p className={cn("text-body-sm", emphasis ? "text-ink-inverse/90" : "text-ink-muted")}>{detail}</p>
          ) : null}
          {children}
        </div>
        {action ? (
          <NextLink
            href={action.href}
            className={buttonClasses({
              variant: emphasis ? "secondary" : "ghost",
              size: "sm",
              className: cn("self-start", !emphasis && "-ml-3 text-primary"),
            })}
          >
            {action.label}
          </NextLink>
        ) : null}
      </>
    )}
  </section>
);

export default TodayTile;
