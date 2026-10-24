import type { ReactNode } from "react";

/** The box shown when hovering a chart point. */
const ChartTooltip = ({ title, detail }: { title: ReactNode; detail?: ReactNode }) => (
  <div className="rounded-input border border-border bg-surface px-3 py-2 shadow-overlay">
    <p className="text-body-sm font-medium text-primary">{title}</p>
    {detail ? <p className="mt-0.5 text-caption text-ink-muted">{detail}</p> : null}
  </div>
);

export default ChartTooltip;
