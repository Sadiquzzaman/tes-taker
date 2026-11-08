"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import useIsStudent from "@/component/Homework/useIsStudent";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Checkbox, ChevronLeftIcon, ChevronRightIcon, Drawer, ErrorState, IconButton, PageHeader, Select, Skeleton } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import { todayInSchool } from "@/utils/schoolDate";
import { type CalendarView, datesBetween, rangeOf, shift } from "./calendarDates";
import { DayAgenda, MonthView, TimeGrid } from "./CalendarViews";
import EventDrawer from "./EventDrawer";
import ItemDrawer from "./ItemDrawer";
import RemindersCard from "./RemindersCard";
import SubscribeCard from "./SubscribeCard";

const VIEWS: CalendarView[] = ["month", "week", "day"];
const KINDS: CalendarFeedItem["kind"][] = ["CLASS", "EVENT", "EXAM", "HOMEWORK", "HOLIDAY"];
const ALL = "all";

type TimedItem = Exclude<CalendarFeedItem, { kind: "HOLIDAY" }>;

/**
 * The person's own calendar (CAL-07), across every workspace they belong to: their classes (with
 * a day's changes), events, exams, homework due and closed days. A month with the chosen day's
 * list beside it, or a week or a day on an hour grid, as in Google Calendar. Anything opens in a
 * drawer; staff add events to the workspace they are in. Reminders and the private link for
 * Google or Apple Calendar are in Settings.
 */
const CalendarPage = () => {
  const t = useTranslations("calendar");
  const format = useFormat();
  const { triggerToast } = useToast();
  const isStudent = useIsStudent();
  const { contextType, organizationId } = useWorkspace();
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(() => todayInSchool());
  const [kinds, setKinds] = useState<Set<CalendarFeedItem["kind"]>>(() => new Set(KINDS));
  const [workspace, setWorkspace] = useState(ALL);
  const [openEvent, setOpenEvent] = useState<{ id: string } | { new: true; date: string } | null>(null);
  const [openItem, setOpenItem] = useState<TimedItem | null>(null);
  const [settings, setSettings] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const range = rangeOf(view, date);
  const { data: feed, failed, reload } = useApiData<CalendarFeed>("/calendar/me", range);
  const today = todayInSchool();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const workspaces = feed?.workspaces ?? [];
  const showWorkspace = workspaces.length > 1;
  const hereKey = contextType === "organization" && organizationId ? `org:${organizationId}` : contextType === "personal_teacher" ? "personal_teacher" : null;
  const isHere = (item: CalendarFeedItem) =>
    !item.workspace || item.workspace.key === hereKey || (contextType === "individual_teacher" && item.workspace.key.startsWith("teacher:"));

  const items = (feed?.items ?? []).filter(
    (item) =>
      kinds.has(item.kind) &&
      (item.kind !== "HOLIDAY" || item.reason === "HOLIDAY" || view === "month") &&
      (workspace === ALL || item.workspace?.key === workspace),
  );
  const timeZone = feed?.time_zone ?? "Asia/Dhaka";
  const title =
    view === "month"
      ? format.date(`${date.slice(0, 7)}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "week"
        ? `${format.date(`${range.from}T00:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })} – ${format.date(`${range.to}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
        : format.date(`${date}T00:00:00Z`, { dateStyle: "full", timeZone: "UTC" });

  const open = (item: TimedItem) => {
    if (item.kind === "EVENT" && isHere(item)) setOpenEvent({ id: item.id });
    else setOpenItem(item);
  };

  const move = (step: -1 | 1) => {
    const next = shift(view, date, step);
    // A month opens on today when it is this month, else on its first day.
    setDate(view === "month" && next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };

  const toggleKind = (kind: CalendarFeedItem["kind"]) =>
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const shared = { timeZone, onOpen: open, showWorkspace };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSettings(true)}>
              {t("settings.open")}
            </Button>
            {isStudent === false ? <Button onClick={() => setOpenEvent({ new: true, date })}>{t("addEvent")}</Button> : null}
          </div>
        }
      />
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconButton label={t("previous")} icon={<ChevronLeftIcon />} onClick={() => move(-1)} />
              <Button size="sm" variant="secondary" onClick={() => setDate(today)}>
                {t("today")}
              </Button>
              <IconButton label={t("next")} icon={<ChevronRightIcon />} onClick={() => move(1)} />
              <h2 className="text-title-sm font-semibold text-ink">{title}</h2>
            </div>
            <div role="group" aria-label={t("viewLabel")} className="flex gap-1">
              {VIEWS.map((value) => (
                <Button key={value} size="sm" variant={view === value ? "primary" : "secondary"} aria-pressed={view === value} onClick={() => setView(value)}>
                  {t(`views.${value}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-4">
              {KINDS.map((kind) => (
                <Checkbox key={kind} label={t(`filters.${kind}`)} checked={kinds.has(kind)} onChange={() => toggleKind(kind)} />
              ))}
            </div>
            {showWorkspace ? (
              <Select
                label={t("workspace")}
                fieldClassName="md:w-64"
                placeholder={false}
                value={workspace}
                onChange={(event) => setWorkspace(event.target.value)}
                options={[{ value: ALL, label: t("allWorkspaces") }, ...workspaces.map((entry) => ({ value: entry.key, label: entry.label }))]}
              />
            ) : null}
          </div>
          {failed !== null ? (
            <ErrorState title={t("loadFailed")} onRetry={reload} />
          ) : !feed ? (
            <div aria-busy="true">
              <Skeleton lines={6} />
            </div>
          ) : view === "month" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <MonthView items={items} timeZone={timeZone} today={today} from={range.from} to={range.to} month={date.slice(0, 7)} selected={date} onSelect={setDate} />
              <section aria-labelledby="calendar-day-title" className="flex flex-col gap-3 rounded-card border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 id="calendar-day-title" className="text-body font-semibold text-ink">
                    {format.date(`${date}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => setView("day")}>
                    {t("openDayView")}
                  </Button>
                </div>
                <DayAgenda items={items} date={date} {...shared} />
              </section>
            </div>
          ) : (
            <TimeGrid
              items={items}
              dates={view === "week" ? datesBetween(range.from, range.to) : [date]}
              today={today}
              now={now}
              onDay={
                view === "week"
                  ? (day) => {
                      setDate(day);
                      setView("day");
                    }
                  : undefined
              }
              {...shared}
            />
          )}
        </div>
      </Card>
      <Drawer open={settings} onClose={() => setSettings(false)} title={t("settings.title")} description={t("settings.intro")} wide>
        <div className="flex flex-col gap-4">
          <RemindersCard />
          <SubscribeCard />
        </div>
      </Drawer>
      <ItemDrawer item={openItem} timeZone={timeZone} here={openItem ? isHere(openItem) : false} showWorkspace={showWorkspace} onClose={() => setOpenItem(null)} />
      {openEvent ? (
        <EventDrawer
          target={openEvent}
          timeZone={timeZone}
          onClose={() => setOpenEvent(null)}
          onSaved={() => {
            setOpenEvent(null);
            triggerToast({ title: t("saved"), type: "success" });
            reload();
          }}
        />
      ) : null}
    </div>
  );
};

export default CalendarPage;
