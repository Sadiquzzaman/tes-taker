import type { BadgeTone } from "@/design/ui";

/**
 * The calendar colours of spec Epic 1: grey upcoming, green present, yellow (amber) late, red
 * absent, blue leave, striped holiday / off day / cancelled class. The letter (messages `myAttendance.letter`) is
 * always shown with the colour.
 */
export const STATUS_TONE: Record<CalendarStatus, BadgeTone> = {
  UPCOMING: "neutral",
  OPEN: "primary",
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  LEAVE: "info",
  CLOSED_DAY: "neutral",
  CANCELLED: "neutral",
  NOT_RECORDED: "neutral",
};

/** Classes for a small status mark (a calendar dot with its letter). */
export const STATUS_MARK: Record<CalendarStatus, string> = {
  UPCOMING: "bg-canvas text-ink-muted border border-border",
  OPEN: "bg-primary-soft text-primary border border-primary",
  PRESENT: "bg-success text-ink-inverse",
  LATE: "bg-warning text-ink-inverse",
  ABSENT: "bg-danger text-ink-inverse",
  LEAVE: "bg-info text-ink-inverse",
  CLOSED_DAY: "text-ink-muted border border-border bg-[repeating-linear-gradient(135deg,var(--color-border)_0_3px,var(--color-surface)_3px_6px)]",
  CANCELLED: "text-ink-muted border border-border bg-[repeating-linear-gradient(135deg,var(--color-border)_0_3px,var(--color-surface)_3px_6px)]",
  NOT_RECORDED: "bg-surface text-ink-muted border border-dashed border-border",
};

/** Calendar statuses in legend order. */
export const LEGEND: CalendarStatus[] = ["UPCOMING", "PRESENT", "LATE", "ABSENT", "LEAVE", "CLOSED_DAY", "CANCELLED"];

/** The status a class shows today: cancelled, its record, or where its check-in window stands. */
export const todayStatus = (item: MyClass): CalendarStatus =>
  (item.blocked === "CANCELLED" ? "CANCELLED" : null) ??
  item.record?.status ?? (item.blocked === "CLOSED_DAY" ? "CLOSED_DAY" : item.state === "OPEN" ? "OPEN" : item.state === "UPCOMING" ? "UPCOMING" : item.mode === "PAPER_REGISTER" ? "NOT_RECORDED" : "ABSENT");

/** Where the browser is, with high accuracy and no cached position (ATT-04). */
export const currentPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });

/** "YYYY-MM" a number of months from another. */
export const shiftMonth = (month: string, by: number): string => {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};
