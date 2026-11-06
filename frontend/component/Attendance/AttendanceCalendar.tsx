"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { LEGEND, STATUS_MARK } from "@/utils/attendance/status";
import { SCHOOL_WEEK, type IsoDay } from "@/utils/schoolDate";

type CalendarDay = MyCalendar["days"][number];

/** ISO day of a school date, read without the device's time zone. */
const isoDayOf = (date: string): IsoDay => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as IsoDay;
};

/** A class's mark: its colour and letter, with the full status for screen readers and on hover. */
export const StatusMark = ({ status, label, className }: { status: CalendarStatus; label: string; className?: string }) => {
  const t = useTranslations("myAttendance");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold leading-none", STATUS_MARK[status], className)}
    >
      <span aria-hidden="true">{t(`letter.${status}`)}</span>
    </span>
  );
};

/**
 * A month grid (design system "Attendance calendar", ATT-18): Saturday first, one mark per class
 * in the agreed colour with its letter; closed days are labelled; the legend explains the marks.
 */
const AttendanceCalendar = ({ calendar }: { calendar: MyCalendar }) => {
  const t = useTranslations("myAttendance");
  const tDays = useTranslations("classSetup.dayShort");
  const format = useFormat();
  const lead = SCHOOL_WEEK.indexOf(isoDayOf(calendar.days[0]?.date ?? `${calendar.month}-01`));
  const time = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return `${format.twoDigits(h)}:${format.twoDigits(m)}`;
  };
  const classLabel = (item: CalendarDay["classes"][number]) =>
    t("markLabel", {
      section: `${item.section.class_name} ${item.section.name}`,
      time: time(item.start_time),
      status: t(`status.${item.status}`),
    });

  return (
    <div className="flex flex-col gap-4">
      <div role="grid" aria-label={t("calendarLabel", { month: format.date(`${calendar.month}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" }) })} className="grid grid-cols-7 gap-1">
        {SCHOOL_WEEK.map((day) => (
          <div key={day} role="columnheader" className="pb-1 text-center text-caption font-medium text-ink-muted">
            {tDays(String(day) as `${IsoDay}`)}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden="true" />
        ))}
        {calendar.days.map((day) => {
          const isToday = day.date === calendar.today;
          const dayNumber = Number(day.date.slice(8));
          return (
            <div
              key={day.date}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              title={day.closed ? t(`closed.${day.closed.reason}`, { name: day.closed.holiday_name ?? "" }) : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 rounded-input border p-1",
                isToday ? "border-primary" : "border-border",
                day.closed && day.classes.length === 0 ? "bg-canvas" : "bg-surface",
              )}
            >
              <span className={cn("text-caption", isToday ? "font-semibold text-primary" : day.closed ? "text-ink-muted" : "text-ink")}>
                {format.number(dayNumber)}
              </span>
              {day.classes.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-0.5">
                  {day.classes.map((item) => (
                    <StatusMark key={`${item.slot_id}-${item.start_time}`} status={item.status} label={classLabel(item)} className="size-5" />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ul aria-label={t("legend")} className="flex flex-wrap gap-x-4 gap-y-2 text-caption text-ink-muted">
        {LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <StatusMark status={status} label={t(`status.${status}`)} className="size-5" />
            <span>{t(`status.${status}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AttendanceCalendar;
