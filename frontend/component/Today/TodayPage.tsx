"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { dateOf } from "@/component/Calendar/calendarDates";
import { AgendaItem, TimeGrid, useLabel } from "@/component/Calendar/CalendarViews";
import ItemDrawer from "@/component/Calendar/ItemDrawer";
import useIsHere from "@/component/Calendar/useIsHere";
import useApiData from "@/component/Homework/useApiData";
import { Card, EmptyState, ErrorState, Link, PageHeader, Skeleton } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import { addDays, todayInSchool } from "@/utils/schoolDate";

type TimedItem = Exclude<CalendarFeedItem, { kind: "HOLIDAY" }>;

/** How far ahead "Due this week" and "Coming up" look, in days. */
const AHEAD_DAYS = 7;
const COMING_UP = 5;

/**
 * Where everyone starts the day (every role, in every workspace at once): today's classes, events,
 * exams and homework on an hour grid from the personal calendar, a note when check-in is open,
 * homework due this week, and what comes up next. Anything opens its details.
 */
const TodayPage = () => {
  const t = useTranslations("today");
  const format = useFormat();
  const label = useLabel();
  const isHere = useIsHere();
  const { memberRole, contextType } = useWorkspace();
  const today = todayInSchool();
  const { data: feed, failed, reload } = useApiData<CalendarFeed>("/calendar/me", { from: today, to: addDays(today, AHEAD_DAYS) });
  const [now, setNow] = useState(() => new Date());
  const [openItem, setOpenItem] = useState<TimedItem | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const timeZone = feed?.time_zone ?? "Asia/Dhaka";
  const showWorkspace = (feed?.workspaces?.length ?? 0) > 1;
  const items = (feed?.items ?? []).filter((item) => item.kind !== "HOLIDAY" || item.reason === "HOLIDAY");
  const timed = items.filter((item): item is TimedItem => item.kind !== "HOLIDAY");
  const todays = items.filter((item) => dateOf(item, timeZone) === today);
  const checkInOpen = todays.filter((item) => item.kind === "CLASS" && item.status === "OPEN");
  const due = timed.filter((item) => item.kind === "HOMEWORK" && item.handed_in !== true && new Date(item.starts_at) >= now);
  const comingUp = timed.filter((item) => (item.kind === "EVENT" || item.kind === "EXAM") && dateOf(item, timeZone) > today && !(item.kind === "EVENT" && item.cancelled)).slice(0, COMING_UP);
  const manager = contextType === "organization" && (memberRole === "OWNER" || memberRole === "ADMIN" || memberRole === "ASSISTANT");
  const shared = { timeZone, onOpen: setOpenItem, showWorkspace };
  const dayOf = (item: TimedItem) => format.date(`${dateOf(item, timeZone)}T00:00:00Z`, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={format.date(`${today}T00:00:00Z`, { dateStyle: "full", timeZone: "UTC" })} />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : !feed ? (
        <Card aria-busy="true">
          <Skeleton lines={6} />
        </Card>
      ) : (
        <>
          {checkInOpen.length ? (
            <Card className="border-primary">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body font-medium text-ink">{t("checkInOpen", { classes: checkInOpen.map((item) => label(item)).join(", ") })}</p>
                <Link href="/my-attendance">{t("checkIn")}</Link>
              </div>
            </Card>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card title={t("schedule")}>
              {feed.workspaces?.length === 0 ? (
                <EmptyState title={t("noCalendar")} description={t("noCalendarHint")} />
              ) : (
                <TimeGrid items={todays} dates={[today]} today={today} now={now} {...shared} />
              )}
            </Card>
            <div className="flex flex-col gap-6">
              <Card title={t("dueTitle")}>
                {due.length === 0 ? (
                  <p className="text-body-sm text-ink-muted">{t("nothingDue")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {due.map((item) => (
                      <li key={item.id} className="flex flex-col gap-1">
                        <span className="text-caption text-ink-muted">{dayOf(item)}</span>
                        <AgendaItem item={item} {...shared} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title={t("comingUpTitle")}>
                {comingUp.length === 0 ? (
                  <p className="text-body-sm text-ink-muted">{t("nothingComingUp")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {comingUp.map((item) => (
                      <li key={`${item.kind}-${item.id}`} className="flex flex-col gap-1">
                        <span className="text-caption text-ink-muted">{dayOf(item)}</span>
                        <AgendaItem item={item} {...shared} />
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/calendar" className="mt-3 self-start">
                  {t("openCalendar")}
                </Link>
              </Card>
              {manager ? (
                <Card title={t("schoolTitle")} description={t("schoolIntro")}>
                  <Link href="/organization">{t("openOverview")}</Link>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}
      <ItemDrawer item={openItem} timeZone={timeZone} here={openItem ? isHere(openItem) : false} showWorkspace={showWorkspace} onClose={() => setOpenItem(null)} />
    </div>
  );
};

export default TodayPage;
