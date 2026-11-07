"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, CloseIcon, Drawer, IconButton, Select, Skeleton, StatusPill } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const TARGETS: ReminderTarget[] = ["CLASS", "EXAM", "EVENT"];
/** The times a reminder can be set to, in minutes before (5 minutes to a day). */
const MINUTES = [5, 10, 15, 30, 45, 60, 90, 120, 180, 360, 720, 1440];
const MAX_REMINDERS = 5;

/** "30 min", "2 h", "1 day" before, in the language's digits. */
const useBefore = () => {
  const t = useTranslations("calendar.reminders");
  return (minutes: number) =>
    minutes >= 1440 && minutes % 1440 === 0
      ? t("days", { count: minutes / 1440 })
      : minutes >= 60 && minutes % 60 === 0
        ? t("hours", { count: minutes / 60 })
        : t("minutes", { count: minutes });
};

/**
 * Reminders before classes, exams and events (CAL-05): the caller's own, per kind, with "use the
 * default" and "off"; owners and admins also set the defaults for everyone. Up to 5 each, in the
 * app or by SMS (SMS uses the organisation's credits).
 */
const RemindersCard = () => {
  const t = useTranslations("calendar.reminders");
  const before = useBefore();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: settings, setData } = useApiData<ReminderSettings>("/reminders");
  const [editing, setEditing] = useState<{ scope: "mine" | "defaults"; target: ReminderTarget } | null>(null);

  const send = async (request: () => Promise<{ data: { payload: ReminderSettings } }>) => {
    try {
      setData((await request()).data.payload);
      triggerToast({ title: t("saved"), type: "success" });
      return true;
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      return false;
    }
  };

  const list = (offsets: ReminderOffset[]) =>
    offsets.length === 0 ? (
      <StatusPill tone="neutral">{t("off")}</StatusPill>
    ) : (
      <span className="flex flex-wrap gap-1">
        {offsets.map((offset) => (
          <StatusPill key={offset.minutes} tone={offset.channel === "SMS" ? "warning" : "info"}>
            {t("item", { before: before(offset.minutes), channel: t(`channels.${offset.channel}`) })}
          </StatusPill>
        ))}
      </span>
    );

  if (!settings) {
    return (
      <Card title={t("title")} aria-busy="true">
        <Skeleton lines={3} />
      </Card>
    );
  }

  return (
    <>
      <Card title={t("title")} description={t("intro")}>
        <ul className="flex flex-col divide-y divide-border">
          {TARGETS.map((target) => (
            <li key={target} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink">{t(`targets.${target}`)}</span>
                {list(settings.mine[target].offsets)}
                {!settings.mine[target].own ? <span className="text-caption text-ink-muted">{t("usingDefault")}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.mine[target].own ? (
                  <Button size="sm" variant="ghost" onClick={() => void send(() => axiosReq.delete(`${baseUrl}/reminders/mine/${target}`))}>
                    {t("useDefault")}
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => setEditing({ scope: "mine", target })} aria-label={t("changeFor", { kind: t(`targets.${target}`) })}>
                  {t("change")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {settings.can_manage ? (
        <Card title={t("defaultsTitle")} description={t("defaultsIntro")}>
          <ul className="flex flex-col divide-y divide-border">
            {TARGETS.map((target) => (
              <li key={target} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-ink">{t(`targets.${target}`)}</span>
                  {list(settings.defaults[target])}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditing({ scope: "defaults", target })} aria-label={t("changeDefaultFor", { kind: t(`targets.${target}`) })}>
                  {t("change")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {editing ? (
        <ReminderEditor
          key={`${editing.scope}-${editing.target}`}
          title={t(editing.scope === "mine" ? "editMine" : "editDefaults", { kind: t(`targets.${editing.target}`) })}
          initial={editing.scope === "mine" ? settings.mine[editing.target].offsets : settings.defaults[editing.target]}
          onClose={() => setEditing(null)}
          onSave={async (offsets) => {
            const path = editing.scope === "mine" ? `mine/${editing.target}` : `defaults/${editing.target}`;
            if (await send(() => axiosReq.put(`${baseUrl}/reminders/${path}`, { offsets }))) setEditing(null);
          }}
        />
      ) : null}
    </>
  );
};

/** A list of up to 5 reminders: when before, and in the app or by SMS. An empty list is "off". */
const ReminderEditor = ({ title, initial, onClose, onSave }: { title: string; initial: ReminderOffset[]; onClose: () => void; onSave: (offsets: ReminderOffset[]) => Promise<void> }) => {
  const t = useTranslations("calendar.reminders");
  const format = useFormat();
  const before = useBefore();
  const [rows, setRows] = useState<ReminderOffset[]>(initial);
  const [busy, setBusy] = useState(false);
  const used = new Set(rows.map((row) => row.minutes));
  const duplicate = used.size !== rows.length;

  const change = (index: number, patch: Partial<ReminderOffset>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => {
    const free = MINUTES.find((minutes) => !used.has(minutes)) ?? 30;
    setRows((current) => [...current, { minutes: free, channel: "IN_APP" }]);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            loading={busy}
            disabled={duplicate}
            onClick={async () => {
              setBusy(true);
              await onSave(rows);
              setBusy(false);
            }}
          >
            {t("save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-ink-muted">{t("editorHint", { max: MAX_REMINDERS })}</p>
        {rows.length === 0 ? <p className="text-body text-ink">{t("noneSet")}</p> : null}
        {rows.map((row, index) => (
          <div key={index} className="flex items-end gap-2">
            <Select
              label={t("when")}
              fieldClassName="flex-1"
              value={String(row.minutes)}
              placeholder={false}
              options={MINUTES.map((minutes) => ({ value: String(minutes), label: before(minutes) }))}
              onChange={(event) => change(index, { minutes: Number(event.target.value) })}
            />
            <Select
              label={t("channel")}
              fieldClassName="flex-1"
              value={row.channel}
              placeholder={false}
              options={(["IN_APP", "SMS"] as const).map((channel) => ({ value: channel, label: t(`channels.${channel}`) }))}
              onChange={(event) => change(index, { channel: event.target.value as ReminderOffset["channel"] })}
            />
            <IconButton label={t("remove", { number: format.number(index + 1) })} icon={<CloseIcon />} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} />
          </div>
        ))}
        {duplicate ? (
          <p role="alert" className="text-body-sm text-danger">
            {t("duplicate")}
          </p>
        ) : null}
        {rows.some((row) => row.channel === "SMS") ? <p className="text-body-sm text-ink-muted">{t("smsHint")}</p> : null}
        <div className="flex flex-wrap gap-2">
          {rows.length < MAX_REMINDERS ? (
            <Button size="sm" variant="secondary" onClick={add}>
              {t("add")}
            </Button>
          ) : null}
          {rows.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setRows([])}>
              {t("turnOff")}
            </Button>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
};

export default RemindersCard;
