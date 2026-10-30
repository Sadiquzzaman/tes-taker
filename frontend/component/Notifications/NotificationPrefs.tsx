"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Card, Checkbox, ErrorState, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

/** Channels a user can switch; in-app (the bell) is always on. */
const OPTIONAL_CHANNELS = ["SMS", "EMAIL"] as const;

/** "How do you want to hear about …" (FND-12): SMS or email per kind of message, in-app always. */
const NotificationPrefs = () => {
  const t = useTranslations("notifications.prefs");
  const tEvents = useTranslations("messageLog.events");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [prefs, setPrefs] = useState<NotificationPref[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await axiosReq.get<{ payload: NotificationPref[] }>(`${baseUrl}/me/notification-prefs`);
      setPrefs(res.data?.payload ?? []);
    } catch {
      setFailed(true);
    }
  }, [baseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (pref: NotificationPref, channel: NotificationChannel, on: boolean) => {
    const channels = on ? [...pref.channels, channel] : pref.channels.filter((c) => c !== channel);
    setSaving(`${pref.event_type}:${channel}`);
    try {
      const res = await axiosReq.put<{ payload: NotificationPref[] }>(`${baseUrl}/me/notification-prefs`, {
        event_type: pref.event_type,
        channels,
      });
      setPrefs(res.data?.payload ?? prefs);
      triggerToast({ title: t("savedTitle"), description: t("saved"), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(null);
    }
  };

  const eventName = (eventType: string) => {
    const key = eventType as Parameters<typeof tEvents>[0];
    return tEvents.has(key) ? tEvents(key) : eventType;
  };

  return (
    <Card title={t("title")} description={t("intro")}>
      {failed ? (
        <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
      ) : !prefs ? (
        <Skeleton lines={3} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {prefs.map((pref) => (
            <li key={pref.event_type} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex flex-col">
                <span className="text-body-sm font-medium text-ink">{eventName(pref.event_type)}</span>
                <span className="text-caption text-ink-muted">{t("inAppAlways")}</span>
              </span>
              <span className="flex flex-wrap gap-4">
                {OPTIONAL_CHANNELS.filter((channel) => pref.allowed.includes(channel)).map((channel) => (
                  <Checkbox
                    key={channel}
                    label={t(`channels.${channel}`)}
                    aria-label={t("channelFor", { channel: t(`channels.${channel}`), message: eventName(pref.event_type) })}
                    checked={pref.channels.includes(channel)}
                    disabled={Boolean(saving)}
                    onChange={(event) => void toggle(pref, channel, event.target.checked)}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="pt-2 text-caption text-ink-muted">{t("smsHint")}</p>
    </Card>
  );
};

export default NotificationPrefs;
