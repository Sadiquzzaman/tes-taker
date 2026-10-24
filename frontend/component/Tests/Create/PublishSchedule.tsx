"use client";

import { useTranslations } from "next-intl";
import { DatePicker, TimePicker } from "@/design/ui";
import { fromZonedParts, toZonedParts } from "@/i18n/zonedTime";
import { setPublishField } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

/** When a scheduled test opens and closes, as date and time in the organisation's time zone. */
const PublishSchedule = () => {
  const t = useTranslations("createTest.publish");
  const dispatch = useAppDispatch();
  const publishState = useAppSelector((state) => (state.createTest as CreateTestState).publishState);

  const row = (field: "scheduleAt" | "endingAt", legend: string) => {
    const { date, time } = toZonedParts(publishState[field]);
    const update = (nextDate: string, nextTime: string) =>
      dispatch(setPublishField({ field, value: fromZonedParts(nextDate, nextTime) }));

    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-ink">{legend}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker label={t("date")} value={date} onChange={(value) => update(value, time)} />
          <TimePicker label={t("time")} value={time} onChange={(value) => update(date || toZonedParts(new Date().toISOString()).date, value)} />
        </div>
      </fieldset>
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-input border border-border p-4">
      {row("scheduleAt", t("startsAt"))}
      {row("endingAt", t("endsAt"))}
      <p className="text-caption text-ink-muted">{t("timeZoneNote")}</p>
    </div>
  );
};

export default PublishSchedule;
