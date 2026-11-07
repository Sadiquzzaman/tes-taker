"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import useIsStudent from "@/component/Homework/useIsStudent";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Checkbox, ChevronLeftIcon, ChevronRightIcon, cn, ErrorState, IconButton, PageHeader, Skeleton } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { todayInSchool } from "@/utils/schoolDate";
import { type CalendarView, rangeOf, shift } from "./calendarDates";
import { DayView, MonthView, WeekView } from "./CalendarViews";
import EventDrawer from "./EventDrawer";
import SubscribeCard from "./SubscribeCard";

const VIEWS: CalendarView[] = ["month", "week", "day"];
const KINDS: CalendarFeedItem["kind"][] = ["CLASS", "EVENT", "EXAM", "HOLIDAY"];

/**
 * The person's calendar (CAL-07): their classes (with a day's changes), events, exams and closed
 * days by month, week or day, filtered by kind. Events open in a drawer; staff add events. Below,
 * a private link adds the calendar to Google or Apple Calendar.
 */
const CalendarPage = () => {
  const t = useTranslations("calendar");
  const format = useFormat();
  const { triggerToast } = useToast();
  const isStudent = useIsStudent();
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(() => todayInSchool());
  const [kinds, setKinds] = useState<Set<CalendarFeedItem["kind"]>>(() => new Set(KINDS));
  const [open, setOpen] = useState<{ id: string } | { new: true; date: string } | null>(null);
  const range = rangeOf(view, date);
  const { data: feed, failed, reload } = useApiData<CalendarFeed>("/calendar/feed", range);
  const today = todayInSchool();

  const items = (feed?.items ?? []).filter((item) => kinds.has(item.kind) && (item.kind !== "HOLIDAY" || item.reason === "HOLIDAY" || view !== "day"));
  const timeZone = feed?.time_zone ?? "Asia/Dhaka";
  const title =
    view === "month"
      ? format.date(`${date.slice(0, 7)}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "week"
        ? `${format.date(`${range.from}T00:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })} – ${format.date(`${range.to}T00:00:00Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
        : format.date(`${date}T00:00:00Z`, { dateStyle: "full", timeZone: "UTC" });

  const openItem = (item: CalendarFeedItem) => {
    if (item.kind === "EVENT") setOpen({ id: item.id });
    else if (item.kind !== "HOLIDAY") {
      setView("day");
      setDate(item.kind === "CLASS" ? item.date : date);
    }
  };

  const toggleKind = (kind: CalendarFeedItem["kind"]) =>
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          isStudent === false ? (
            <Button onClick={() => setOpen({ new: true, date: view === "month" && date.slice(0, 7) !== today.slice(0, 7) ? `${date.slice(0, 7)}-01` : date })}>{t("addEvent")}</Button>
          ) : undefined
        }
      />
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconButton label={t("previous")} icon={<ChevronLeftIcon />} onClick={() => setDate(shift(view, date, -1))} />
              <Button size="sm" variant="secondary" onClick={() => setDate(today)}>
                {t("today")}
              </Button>
              <IconButton label={t("next")} icon={<ChevronRightIcon />} onClick={() => setDate(shift(view, date, 1))} />
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
          <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-4">
            {KINDS.map((kind) => (
              <Checkbox key={kind} label={t(`filters.${kind}`)} checked={kinds.has(kind)} onChange={() => toggleKind(kind)} />
            ))}
          </div>
          {failed !== null ? (
            <ErrorState title={t("loadFailed")} onRetry={reload} />
          ) : !feed ? (
            <div aria-busy="true">
              <Skeleton lines={6} />
            </div>
          ) : (
            <div className={cn(view === "day" && "max-w-2xl")}>
              {view === "month" ? (
                <MonthView
                  items={items}
                  timeZone={timeZone}
                  today={today}
                  onOpen={openItem}
                  from={range.from}
                  to={range.to}
                  month={date.slice(0, 7)}
                  onDay={(day) => {
                    setDate(day);
                    setView("day");
                  }}
                />
              ) : view === "week" ? (
                <WeekView items={items} timeZone={timeZone} today={today} onOpen={openItem} from={range.from} to={range.to} />
              ) : (
                <DayView items={items} timeZone={timeZone} today={today} onOpen={openItem} date={date} />
              )}
            </div>
          )}
        </div>
      </Card>
      <SubscribeCard />
      {open ? (
        <EventDrawer
          target={open}
          timeZone={timeZone}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            triggerToast({ title: t("saved"), type: "success" });
            reload();
          }}
        />
      ) : null}
    </div>
  );
};

export default CalendarPage;
