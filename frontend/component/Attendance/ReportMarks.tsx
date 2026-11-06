"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { DAY_COLOUR } from "@/utils/attendance/reports";
import { STATUS_MARK } from "@/utils/attendance/status";

/**
 * A day of the register (ATT-13): the colour and letter of the day (P, L, A, LV or উ, দে, অ, ছু),
 * with a small number for the classes missed on a day the student came to others. Empty when no
 * class counted that day; a day still waiting shows as upcoming without a letter.
 */
export const DayCell = ({ day }: { day: ReportDayMark | null }) => {
  const letter = useTranslations("myAttendance.letter");
  const t = useTranslations("reports");
  const format = useFormat();
  if (!day) return <span className="text-ink-muted">·</span>;
  const status = DAY_COLOUR[day.status];
  const label = day.missed > 0 ? t("dayMissed", { status: t(`day.${day.status}`), missed: day.missed }) : t(`day.${day.status}`);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-caption font-semibold leading-none", STATUS_MARK[status])}
    >
      {day.status === "WAITING" ? "" : letter(status)}
      {day.missed > 0 ? <sub className="ml-px">{format.number(day.missed)}</sub> : null}
    </span>
  );
};

/** The letters and colours used on the reports and their printouts. */
export const ReportLegend = ({ missed = true }: { missed?: boolean }) => {
  const letter = useTranslations("myAttendance.letter");
  const t = useTranslations("reports");
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted" aria-label={t("legend")}>
      {(["PRESENT", "LATE", "ABSENT", "LEAVE"] as const).map((status) => (
        <li key={status} className="flex items-center gap-1">
          <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-semibold leading-none", STATUS_MARK[status])}>{letter(status)}</span>
          {t(`day.${status}`)}
        </li>
      ))}
      {missed ? <li>{t("legendMissed")}</li> : null}
    </ul>
  );
};
