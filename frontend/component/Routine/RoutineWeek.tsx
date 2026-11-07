"use client";

import { useTranslations } from "next-intl";
import { StatusPill } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { type IsoDay, SCHOOL_WEEK } from "@/utils/schoolDate";

export const sectionLabel = (section: RoutineSection) => (section.class_name ? `${section.class_name} ${section.name}` : section.name);

/** "10:00" in the language's digits. */
export const useClock = () => {
  const format = useFormat();
  return (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return `${format.twoDigits(h)}:${format.twoDigits(m)}`;
  };
};

/**
 * A week of routine slots, Saturday first, one column per day (stacked on phones). Each slot shows
 * its time, subject, section, teacher and room; a clash is marked. `onOpen` makes slots buttons.
 */
const RoutineWeek = ({ slots, show, onOpen }: { slots: RoutineSlot[]; show: { section?: boolean; teacher?: boolean }; onOpen?: (slot: RoutineSlot) => void }) => {
  const t = useTranslations("routine");
  const clock = useClock();
  const days = SCHOOL_WEEK;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-7">
      {days.map((day) => {
        const own = slots.filter((slot) => slot.day_of_week === day);
        return (
          <section key={day} aria-label={t(`days.${day as IsoDay}`)} className="flex flex-col gap-2 rounded-card border border-border bg-canvas p-2">
            <h3 className="px-1 text-body-sm font-semibold text-ink">{t(`days.${day as IsoDay}`)}</h3>
            {own.length === 0 ? <p className="px-1 text-caption text-ink-muted">{t("noClasses")}</p> : null}
            {own.map((slot) => {
              const body = (
                <>
                  <span className="text-caption font-medium text-ink-muted">
                    {clock(slot.start_time)}–{clock(slot.end_time)}
                  </span>
                  <span className="font-medium text-ink">{slot.subject?.name ?? t("noSubject")}</span>
                  {show.section ? <span className="text-body-sm text-ink">{sectionLabel(slot.section)}</span> : null}
                  {show.teacher !== false && slot.teacher ? <span className="text-body-sm text-ink-muted">{slot.teacher.full_name}</span> : null}
                  {slot.room ? <span className="text-body-sm text-ink-muted">{t("roomShort", { room: slot.room })}</span> : null}
                  {slot.clashes.length ? (
                    <StatusPill tone="warning">{slot.clashes.some((c) => c.kind === "TEACHER") ? t("clash.TEACHER") : t("clash.ROOM")}</StatusPill>
                  ) : null}
                </>
              );
              return onOpen ? (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onOpen(slot)}
                  className="flex flex-col items-start gap-0.5 rounded-input border border-border bg-surface p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {body}
                </button>
              ) : (
                <div key={slot.id} className="flex flex-col gap-0.5 rounded-input border border-border bg-surface p-2">
                  {body}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
};

export default RoutineWeek;
