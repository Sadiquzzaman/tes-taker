"use client";

import { useTranslations } from "next-intl";
import { cn, StatusPill } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { toZonedParts } from "@/i18n/zonedTime";
import { type IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";
import { dateOf, datesBetween, isoDayOf } from "./calendarDates";

/** Item colours by kind, from the design tokens. */
const KIND_CLASS: Record<CalendarFeedItem["kind"], string> = {
  CLASS: "border-l-primary bg-primary-soft",
  EVENT: "border-l-success bg-success-soft",
  EXAM: "border-l-warning bg-warning-soft",
  HOLIDAY: "border-l-border bg-canvas",
};

interface ViewProps {
  items: CalendarFeedItem[];
  timeZone: string;
  today: string;
  onOpen: (item: CalendarFeedItem) => void;
}

const isCancelled = (item: CalendarFeedItem) => (item.kind === "CLASS" && item.status === "CANCELLED") || (item.kind === "EVENT" && item.cancelled);

/** "10:00" in the language's digits, on the clock of the organisation's time zone. */
const useClock = (timeZone: string) => {
  const format = useFormat();
  return (iso: string) => {
    const [h, m] = toZonedParts(iso, timeZone).time.split(":").map(Number);
    return `${format.twoDigits(h)}:${format.twoDigits(m)}`;
  };
};

/** The title shown for an item: a class's subject and section, else its title. */
const useLabel = () => {
  const t = useTranslations("calendar");
  return (item: CalendarFeedItem) => {
    if (item.kind === "CLASS") return item.subject ? `${item.subject} · ${item.title}` : item.title;
    if (item.kind === "HOLIDAY") return item.title || t(`closed.${item.reason}`);
    return item.title;
  };
};

/** One item as a button (holidays are plain labels). */
const ItemChip = ({ item, timeZone, onOpen, compact }: { item: CalendarFeedItem; timeZone: string; onOpen: ViewProps["onOpen"]; compact?: boolean }) => {
  const t = useTranslations("calendar");
  const clock = useClock(timeZone);
  const label = useLabel();
  if (item.kind === "HOLIDAY") {
    return <span className="block truncate rounded-input bg-canvas px-1.5 py-0.5 text-caption text-ink-muted">{label(item)}</span>;
  }
  const cancelled = isCancelled(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={t("openItem", { kind: t(`kinds.${item.kind}`), title: label(item), time: clock(item.starts_at) })}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-input border-l-4 px-1.5 py-1 text-left text-caption text-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary",
        KIND_CLASS[item.kind],
        cancelled && "line-through opacity-70",
      )}
    >
      <span className="w-full truncate">
        <span className="font-medium">{clock(item.starts_at)}</span> {label(item)}
      </span>
      {!compact && item.kind === "CLASS" && (item.room || item.teacher) ? (
        <span className="w-full truncate text-ink-muted">{[item.teacher, item.room].filter(Boolean).join(" · ")}</span>
      ) : null}
      {!compact && item.kind === "EVENT" && item.place ? <span className="w-full truncate text-ink-muted">{item.place}</span> : null}
      {!compact && cancelled ? <StatusPill tone="neutral">{t("cancelled")}</StatusPill> : null}
    </button>
  );
};

const byDate = (items: CalendarFeedItem[], timeZone: string) => {
  const map = new Map<string, CalendarFeedItem[]>();
  for (const item of items) {
    const date = dateOf(item, timeZone);
    map.set(date, [...(map.get(date) ?? []), item]);
  }
  return map;
};

/** A month grid, Saturday first; each day lists its items (at most 3, then "+N more"). */
export const MonthView = ({ items, timeZone, today, onOpen, from, to, month, onDay }: ViewProps & { from: string; to: string; month: string; onDay: (date: string) => void }) => {
  const t = useTranslations("calendar");
  const tDays = useTranslations("classSetup.dayShort");
  const format = useFormat();
  const map = byDate(items, timeZone);
  return (
    <div role="grid" aria-label={t("monthLabel")} className="grid grid-cols-7 gap-1">
      {SCHOOL_WEEK.map((day) => (
        <div key={day} role="columnheader" className="pb-1 text-center text-caption font-medium text-ink-muted">
          {tDays(String(day) as `${IsoDay}`)}
        </div>
      ))}
      {datesBetween(from, to).map((date) => {
        const own = map.get(date) ?? [];
        const shown = own.slice(0, 3);
        return (
          <div
            key={date}
            role="gridcell"
            aria-current={date === today ? "date" : undefined}
            className={cn("flex min-h-24 flex-col gap-1 rounded-input border border-border p-1", date.slice(0, 7) !== month && "opacity-50", date === today && "border-primary")}
          >
            <button type="button" onClick={() => onDay(date)} className="self-start rounded-input px-1 text-caption font-medium text-ink hover:bg-canvas" aria-label={t("openDay", { date: format.date(`${date}T00:00:00Z`, { day: "numeric", month: "long", timeZone: "UTC" }) })}>
              {format.number(Number(date.slice(8)))}
            </button>
            {shown.map((item) => (
              <ItemChip key={`${item.kind}-${item.id}`} item={item} timeZone={timeZone} onOpen={onOpen} compact />
            ))}
            {own.length > shown.length ? (
              <button type="button" onClick={() => onDay(date)} className="self-start text-caption text-primary underline">
                {t("more", { count: own.length - shown.length })}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** A week, one column per day (stacked on phones). */
export const WeekView = ({ items, timeZone, today, onOpen, from, to }: ViewProps & { from: string; to: string }) => {
  const t = useTranslations("calendar");
  const format = useFormat();
  const tDays = useTranslations("routine.days");
  const map = byDate(items, timeZone);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-7">
      {datesBetween(from, to).map((date) => {
        const own = map.get(date) ?? [];
        return (
          <section key={date} aria-label={tDays(String(isoDayOf(date)) as `${IsoDay}`)} className={cn("flex flex-col gap-2 rounded-card border border-border p-2", date === today && "border-primary")}>
            <h3 className="text-body-sm font-semibold text-ink">
              {tDays(String(isoDayOf(date)) as `${IsoDay}`)} <span className="font-normal text-ink-muted">{format.date(`${date}T00:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })}</span>
            </h3>
            {own.length === 0 ? <p className="text-caption text-ink-muted">{t("nothing")}</p> : null}
            {own.map((item) => (
              <ItemChip key={`${item.kind}-${item.id}`} item={item} timeZone={timeZone} onOpen={onOpen} />
            ))}
          </section>
        );
      })}
    </div>
  );
};

/** One day as a list. */
export const DayView = ({ items, timeZone, onOpen, date }: ViewProps & { date: string }) => {
  const t = useTranslations("calendar");
  const own = items.filter((item) => dateOf(item, timeZone) === date);
  if (own.length === 0) return <p className="py-6 text-center text-body text-ink-muted">{t("nothingThisDay")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {own.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <ItemChip item={item} timeZone={timeZone} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
};
