"use client";

import { useTranslations } from "next-intl";
import { cn, StatusPill } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { toZonedParts } from "@/i18n/zonedTime";
import { type IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";
import { dateOf, datesBetween, hourRange, isoDayOf, layoutDay, minutesOf } from "./calendarDates";

type TimedItem = Exclude<CalendarFeedItem, { kind: "HOLIDAY" }>;

/** Item colours by kind, from the design tokens. */
const KIND_CLASS: Record<CalendarFeedItem["kind"], string> = {
  CLASS: "border-l-primary bg-primary-soft",
  EVENT: "border-l-success bg-success-soft",
  EXAM: "border-l-warning bg-warning-soft",
  HOMEWORK: "border-l-info bg-info-soft",
  HOLIDAY: "border-l-border bg-canvas",
};

/** One hour on the hour grid, in pixels. */
const HOUR_PX = 48;

export const isCancelled = (item: CalendarFeedItem) => (item.kind === "CLASS" && item.status === "CANCELLED") || (item.kind === "EVENT" && item.cancelled);

const isTimed = (item: CalendarFeedItem): item is TimedItem => item.kind !== "HOLIDAY";

/** "10:00" in the language's digits, on the clock of the organisation's time zone. */
export const useClock = (timeZone: string) => {
  const format = useFormat();
  return (iso: string) => {
    const [h, m] = toZonedParts(iso, timeZone).time.split(":").map(Number);
    return `${format.twoDigits(h)}:${format.twoDigits(m)}`;
  };
};

/** The title shown for an item: a class's subject and section, homework "Due: …", else its title. */
export const useLabel = () => {
  const t = useTranslations("calendar");
  return (item: CalendarFeedItem) => {
    if (item.kind === "CLASS") return item.subject ? `${item.subject} · ${item.title}` : item.title;
    if (item.kind === "HOLIDAY") return item.title || t(`closed.${item.reason}`);
    if (item.kind === "HOMEWORK") return t("due", { title: item.title });
    return item.title;
  };
};

/** The second line of an item: who and where, the homework's subject and sections, and the workspace when there are several. */
const detailOf = (item: CalendarFeedItem, showWorkspace: boolean) => {
  const parts =
    item.kind === "CLASS"
      ? // A teacher's own classes don't repeat their name.
        [item.role === "TEACHER" ? null : item.teacher, item.room]
      : item.kind === "EVENT"
        ? [item.place]
        : item.kind === "HOMEWORK"
          ? [item.subject, item.sections.join(", ")]
          : item.kind === "EXAM"
            ? [item.class_name]
            : [];
  if (showWorkspace && item.workspace) parts.push(item.workspace.label);
  return parts.filter(Boolean).join(" · ");
};

interface OpenProps {
  timeZone: string;
  onOpen: (item: TimedItem) => void;
  /** Name the workspace on each item (when the person has more than one). */
  showWorkspace: boolean;
}

/** One item in a day's list: its times, title, details and state. */
export const AgendaItem = ({ item, timeZone, onOpen, showWorkspace }: OpenProps & { item: TimedItem }) => {
  const t = useTranslations("calendar");
  const clock = useClock(timeZone);
  const label = useLabel();
  const detail = detailOf(item, showWorkspace);
  const cancelled = isCancelled(item);
  const time = item.kind === "HOMEWORK" ? clock(item.starts_at) : `${clock(item.starts_at)}–${clock(item.ends_at)}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={t("openItem", { kind: t(`kinds.${item.kind}`), title: label(item), time: clock(item.starts_at) })}
      className={cn(
        "flex w-full items-start gap-3 rounded-input border-l-4 px-3 py-2 text-left text-body-sm text-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary",
        KIND_CLASS[item.kind],
      )}
    >
      <span className="w-24 shrink-0 font-medium tabular-nums">{time}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate font-medium", cancelled && "line-through opacity-70")}>{label(item)}</span>
        {detail ? <span className="truncate text-caption text-ink-muted">{detail}</span> : null}
      </span>
      {cancelled ? <StatusPill tone="neutral">{t("cancelled")}</StatusPill> : null}
      {item.kind === "HOMEWORK" && item.handed_in !== null ? (
        <StatusPill tone={item.handed_in ? "success" : "warning"}>{t(item.handed_in ? "handedIn" : "notHandedIn")}</StatusPill>
      ) : null}
    </button>
  );
};

/** A holiday or weekly off day, as a plain label. */
const ClosedLabel = ({ item }: { item: Extract<CalendarFeedItem, { kind: "HOLIDAY" }> }) => {
  const label = useLabel();
  return <span className="block truncate rounded-input bg-canvas px-1.5 py-0.5 text-caption text-ink-muted">{label(item)}</span>;
};

const byDate = (items: CalendarFeedItem[], timeZone: string) => {
  const map = new Map<string, CalendarFeedItem[]>();
  for (const item of items) {
    const date = dateOf(item, timeZone);
    map.set(date, [...(map.get(date) ?? []), item]);
  }
  return map;
};

/**
 * A month grid, Saturday first. Each day is one button that selects it (the day's list shows
 * beside the grid): holidays by name, the routine's classes as a count, and events, exams and
 * homework as short chips (two, then "+N more").
 */
export const MonthView = ({
  items,
  timeZone,
  today,
  from,
  to,
  month,
  selected,
  onSelect,
}: {
  items: CalendarFeedItem[];
  timeZone: string;
  today: string;
  from: string;
  to: string;
  month: string;
  selected: string;
  onSelect: (date: string) => void;
}) => {
  const t = useTranslations("calendar");
  const tDays = useTranslations("classSetup.dayShort");
  const format = useFormat();
  const clock = useClock(timeZone);
  const label = useLabel();
  const map = byDate(items, timeZone);
  return (
    <div aria-label={t("monthLabel")} role="group" className="grid grid-cols-7 gap-1">
      {SCHOOL_WEEK.map((day) => (
        <div key={day} aria-hidden="true" className="pb-1 text-center text-caption font-medium text-ink-muted">
          {tDays(String(day) as `${IsoDay}`)}
        </div>
      ))}
      {datesBetween(from, to).map((date) => {
        const own = map.get(date) ?? [];
        const closed = own.filter((item) => item.kind === "HOLIDAY");
        const classes = own.filter((item) => item.kind === "CLASS");
        const others = own.filter((item) => item.kind !== "HOLIDAY" && item.kind !== "CLASS");
        const shown = others.slice(0, 2);
        const summary = [
          ...closed.map((item) => label(item)),
          classes.length ? t("classCount", { count: classes.length }) : null,
          ...others.map((item) => label(item)),
        ].filter(Boolean);
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            aria-pressed={date === selected}
            aria-current={date === today ? "date" : undefined}
            aria-label={[format.date(`${date}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }), summary.length ? summary.join(", ") : t("nothing")].join(": ")}
            className={cn(
              "flex min-h-20 min-w-0 flex-col items-stretch gap-0.5 rounded-input border border-border p-1 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-primary md:min-h-24",
              date.slice(0, 7) !== month && "opacity-50",
              date === selected && "border-primary bg-primary-soft",
            )}
          >
            <span className={cn("self-start rounded-pill px-1.5 text-caption font-medium text-ink", date === today && "bg-primary text-ink-inverse")}>
              {format.number(Number(date.slice(8)))}
            </span>
            {closed.map((item) => (
              <ClosedLabel key={item.id} item={item as Extract<CalendarFeedItem, { kind: "HOLIDAY" }>} />
            ))}
            {classes.length ? <span className="truncate px-1 text-caption text-primary">{t("classCount", { count: classes.length })}</span> : null}
            {shown.map((item) => (
              <span
                key={`${item.kind}-${item.id}`}
                className={cn("hidden truncate rounded-input border-l-4 px-1 text-caption text-ink sm:block", KIND_CLASS[item.kind], isCancelled(item) && "line-through opacity-70")}
              >
                {isTimed(item) && item.kind !== "HOMEWORK" ? `${clock(item.starts_at)} ` : ""}
                {label(item)}
              </span>
            ))}
            {others.length > shown.length ? <span className="hidden px-1 text-caption text-ink-muted sm:block">{t("more", { count: others.length - shown.length })}</span> : null}
            {others.length ? <span aria-hidden="true" className="mx-1 mt-auto h-1.5 w-1.5 rounded-pill bg-success sm:hidden" /> : null}
          </button>
        );
      })}
    </div>
  );
};

/** One day as a list, in time order, with its holidays first. */
export const DayAgenda = ({ items, date, ...props }: OpenProps & { items: CalendarFeedItem[]; date: string }) => {
  const t = useTranslations("calendar");
  const own = items.filter((item) => dateOf(item, props.timeZone) === date);
  const closed = own.filter((item) => item.kind === "HOLIDAY");
  const timed = own.filter(isTimed);
  return (
    <div className="flex flex-col gap-2">
      {closed.map((item) => (
        <ClosedLabel key={item.id} item={item as Extract<CalendarFeedItem, { kind: "HOLIDAY" }>} />
      ))}
      {timed.length === 0 ? <p className="py-4 text-center text-body-sm text-ink-muted">{t("nothingThisDay")}</p> : null}
      <ul className="flex flex-col gap-2">
        {timed.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <AgendaItem item={item} {...props} />
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Days on an hour grid, as in Google Calendar: one column per day, items placed by their times
 * and side by side where they overlap, holidays in a row above, and a line at the current time.
 * Day headings open that day.
 */
export const TimeGrid = ({
  items,
  dates,
  today,
  now,
  onDay,
  ...props
}: OpenProps & { items: CalendarFeedItem[]; dates: string[]; today: string; now: Date; onDay?: (date: string) => void }) => {
  const t = useTranslations("calendar");
  const tDays = useTranslations("routine.days");
  const format = useFormat();
  const clock = useClock(props.timeZone);
  const label = useLabel();
  const map = byDate(items, props.timeZone);
  const columns = dates.map((date) => {
    const own = map.get(date) ?? [];
    return { date, closed: own.filter((item) => item.kind === "HOLIDAY"), placed: layoutDay(own.filter(isTimed), props.timeZone) };
  });
  const { first, last } = hourRange(columns.flatMap((column) => column.placed));
  const hours = Array.from({ length: last - first }, (_, index) => first + index);
  const nowMinutes = minutesOf(now.toISOString(), props.timeZone);
  const anyClosed = columns.some((column) => column.closed.length > 0);
  const gridColumns = { gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` };

  return (
    <div className={cn(dates.length > 1 && "overflow-x-auto")}>
      <div className={cn("flex flex-col", dates.length > 1 && "min-w-[42rem]")}>
        <div className="grid border-b border-border pb-1" style={gridColumns}>
          <span />
          {dates.map((date) => {
            const name = tDays(String(isoDayOf(date)) as `${IsoDay}`);
            const heading = (
              <>
                <span className="text-caption text-ink-muted">{name}</span>
                <span className={cn("rounded-pill px-2 text-title-sm font-semibold text-ink", date === today && "bg-primary text-ink-inverse")}>{format.number(Number(date.slice(8)))}</span>
              </>
            );
            return onDay ? (
              <button key={date} type="button" onClick={() => onDay(date)} aria-label={t("openDay", { date: format.date(`${date}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) })} className="flex flex-col items-center gap-0.5 rounded-input py-1 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-primary">
                {heading}
              </button>
            ) : (
              <div key={date} className="flex flex-col items-center gap-0.5 py-1">
                {heading}
              </div>
            );
          })}
        </div>
        {anyClosed ? (
          <div className="grid gap-1 border-b border-border py-1" style={gridColumns}>
            <span className="text-caption text-ink-muted">{t("allDay")}</span>
            {columns.map((column) => (
              <div key={column.date} className="flex min-w-0 flex-col gap-1">
                {column.closed.map((item) => (
                  <ClosedLabel key={item.id} item={item as Extract<CalendarFeedItem, { kind: "HOLIDAY" }>} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid" style={gridColumns}>
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((hour, index) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-caption text-ink-muted tabular-nums" style={{ top: index * HOUR_PX }}>
                {index === 0 ? "" : `${format.twoDigits(hour)}:${format.twoDigits(0)}`}
              </span>
            ))}
          </div>
          {columns.map((column) => (
            <section
              key={column.date}
              aria-label={format.date(`${column.date}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
              className="relative border-l border-border"
              style={{ height: hours.length * HOUR_PX }}
            >
              {hours.map((hour, index) => (
                <span key={hour} aria-hidden="true" className="absolute inset-x-0 border-t border-border" style={{ top: index * HOUR_PX }} />
              ))}
              {column.date === today && nowMinutes >= first * 60 && nowMinutes <= last * 60 ? (
                <span aria-hidden="true" className="absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: ((nowMinutes - first * 60) / 60) * HOUR_PX }} />
              ) : null}
              {column.placed.length === 0 ? <span className="sr-only">{t("nothingThisDay")}</span> : null}
              {column.placed.map(({ item, start, end, column: index, columns: count }) => {
                const height = ((end - start) / 60) * HOUR_PX;
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() => props.onOpen(item)}
                    aria-label={t("openItem", { kind: t(`kinds.${item.kind}`), title: label(item), time: clock(item.starts_at) })}
                    className={cn(
                      "absolute flex flex-col overflow-hidden rounded-input border-l-4 px-1.5 py-0.5 text-left text-caption text-ink hover:z-20 hover:opacity-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary",
                      KIND_CLASS[item.kind],
                      isCancelled(item) && "line-through opacity-70",
                    )}
                    style={{ top: ((start - first * 60) / 60) * HOUR_PX + 1, height: height - 2, left: `calc(${(index / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)` }}
                  >
                    <span className="truncate font-medium">{label(item)}</span>
                    {height >= 36 ? <span className="truncate text-ink-muted">{item.kind === "HOMEWORK" ? clock(item.starts_at) : `${clock(item.starts_at)}–${clock(item.ends_at)}`}</span> : null}
                    {height >= 56 ? <span className="truncate text-ink-muted">{detailOf(item, props.showWorkspace)}</span> : null}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
