"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Card, ChevronLeftIcon, ChevronRightIcon, cn, IconButton, Skeleton } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import { useIsClient } from "@/hooks/useBrowserStorage";
import { monthGrid, monthTitle, todayInTimeZone, weekDayNames } from "@/utils/Dashboard/calendar";

/** A month of the teacher's tests: days with tests are marked; today is highlighted (Dhaka time). */
const Calendar = () => {
  const t = useTranslations("dashboard.calendar");
  const format = useFormat();
  const { data, loading, calendarYear: year, calendarMonth: month, setCalendarMonth, setCalendarYear } = useDashboard();
  const isClient = useIsClient();
  // Read the clock only in the browser, so the server render does not depend on it.
  const [today, setToday] = useState<ReturnType<typeof todayInTimeZone> | null>(null);
  if (isClient && today === null) {
    setToday(todayInTimeZone());
  }

  const testsByDay = useMemo(() => {
    const counts = new Map<number, number>();
    for (const event of data?.calendar_events ?? []) {
      if (event.year === year && event.month === month) {
        counts.set(event.day, (counts.get(event.day) ?? 0) + event.test_count);
      }
    }
    return counts;
  }, [data?.calendar_events, month, year]);

  const moveMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    setCalendarYear(Math.floor(index / 12));
    setCalendarMonth((index % 12) + 1);
  };

  const dayNames = weekDayNames(format.locale);
  const isToday = (day: number) => today?.day === day && today.month === month && today.year === year;

  return (
    <Card
      title={t("title")}
      className="h-full"
      actions={
        <div className="flex items-center gap-1">
          <IconButton size="sm" label={t("previousMonth")} icon={<ChevronLeftIcon />} onClick={() => moveMonth(-1)} />
          <span className="min-w-32 text-center text-body-sm font-medium text-ink" aria-live="polite">
            {monthTitle(month, year, format.locale)}
          </span>
          <IconButton size="sm" label={t("nextMonth")} icon={<ChevronRightIcon />} onClick={() => moveMonth(1)} />
        </div>
      }
    >
      {loading ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <table className="w-full table-fixed border-collapse text-center text-body-sm">
            <caption className="sr-only">{monthTitle(month, year, format.locale)}</caption>
            <thead>
              <tr>
                {dayNames.map((name) => (
                  <th key={name} scope="col" className="pb-2 text-caption font-medium text-ink-muted">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(month, year).map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) => {
                    const tests = day ? (testsByDay.get(day) ?? 0) : 0;
                    return (
                      <td key={dayIndex} className="p-0.5">
                        {day ? (
                          <span
                            aria-current={isToday(day) ? "date" : undefined}
                            className={cn(
                              "mx-auto flex h-9 w-full max-w-10 flex-col items-center justify-center rounded-input",
                              isToday(day) ? "bg-primary font-semibold text-ink-inverse" : "text-ink",
                            )}
                          >
                            {format.number(day)}
                            <span
                              aria-hidden="true"
                              className={cn("size-1 rounded-full", tests ? (isToday(day) ? "bg-ink-inverse" : "bg-primary") : "bg-transparent")}
                            />
                            {tests ? <span className="sr-only">{t("hasTests", { count: tests })}</span> : null}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {testsByDay.size === 0 ? <p className="mt-3 text-center text-caption text-ink-muted">{t("noEvents")}</p> : null}
        </>
      )}
    </Card>
  );
};

export default Calendar;
