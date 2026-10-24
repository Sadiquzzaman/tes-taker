"use client";

import type { ReactNode } from "react";
import useFormat from "@/i18n/useFormat";
import { cn } from "./cn";
import { ArrowDownIcon, ArrowUpIcon } from "./icons";

export interface StatTileProps {
  label: ReactNode;
  /** A number is formatted for the language (Bangla digits); pass a string for anything else. */
  value: number | string;
  /** Change since the last period, e.g. +4 or -2.5; shown with an arrow. */
  change?: number;
  /** What the change is compared with, e.g. "vs last week". */
  changeLabel?: ReactNode;
  /** Whether a rise is good (green) or bad (red); default good. */
  higherIsBetter?: boolean;
  icon?: ReactNode;
  className?: string;
}

/** One number on a dashboard, with an optional trend. */
const StatTile = ({ label, value, change, changeLabel, higherIsBetter = true, icon, className }: StatTileProps) => {
  const format = useFormat();
  const isUp = typeof change === "number" && change > 0;
  const isDown = typeof change === "number" && change < 0;
  const good = (isUp && higherIsBetter) || (isDown && !higherIsBetter);

  return (
    <div className={cn("flex flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm text-ink-muted">{label}</p>
        {icon ? <span className="text-ink-muted">{icon}</span> : null}
      </div>
      <p className="text-title font-semibold text-ink">{typeof value === "number" ? format.number(value) : value}</p>
      {typeof change === "number" ? (
        <p className="flex items-center gap-1 text-caption">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              change === 0 ? "text-ink-muted" : good ? "text-success" : "text-danger",
            )}
          >
            {isUp ? <ArrowUpIcon className="size-3" /> : isDown ? <ArrowDownIcon className="size-3" /> : null}
            {format.number(Math.abs(change))}
          </span>
          {changeLabel ? <span className="text-ink-muted">{changeLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
};

export default StatTile;
