"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, Input } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

/**
 * "Add to Google or Apple Calendar" (CAL-07): one private subscription link for all the person's
 * workspaces (`/calendar/me/ical-link`). The link is shown once,
 * when made; making a new one stops the old one, and it can be turned off. `bare` leaves out the
 * card and its heading (inside a drawer that already has them).
 */
const SubscribeCard = ({ bare = false }: { bare?: boolean }) => {
  const t = useTranslations("calendar.subscribe");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: status, setData } = useApiData<{ active: boolean; created_at: string | null }>("/calendar/me/ical-link");
  const [link, setLink] = useState<string | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      const made = (await axiosReq.post<ApiResponse<{ path: string; created_at: string }>>(`${baseUrl}/calendar/me/ical-link`, {})).data.payload;
      setLink(`${baseUrl}${made.path}`);
      setData({ active: true, created_at: made.created_at });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await axiosReq.delete(`${baseUrl}/calendar/me/ical-link`);
      setLink(null);
      setData({ active: false, created_at: null });
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
      setTurningOff(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      triggerToast({ title: t("copied"), type: "success" });
    } catch {
      // The field stays selectable for copying by hand.
    }
  };

  const body = (
    <>
      <div className="flex flex-col gap-3">
        {link ? (
          <>
            <Input label={t("link")} hint={t("linkHint")} value={link} readOnly onFocus={(event) => event.target.select()} />
            <ol className="list-decimal pl-5 text-body-sm text-ink-muted">
              <li>{t("stepGoogle")}</li>
              <li>{t("stepApple")}</li>
            </ol>
          </>
        ) : status?.active && status.created_at ? (
          <p className="text-body-sm text-ink">{t("activeSince", { when: format.dateTime(status.created_at) })}</p>
        ) : (
          <p className="text-body-sm text-ink-muted">{t("none")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {link ? (
            <Button onClick={() => void copy()}>{t("copy")}</Button>
          ) : (
            <Button onClick={() => void make()} loading={busy} variant={status?.active ? "secondary" : "primary"}>
              {status?.active ? t("newLink") : t("make")}
            </Button>
          )}
          {status?.active ? (
            <Button variant="ghost" onClick={() => setTurningOff(true)}>
              {t("turnOff")}
            </Button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={turningOff}
        title={t("turnOffTitle")}
        description={t("turnOffDetail")}
        confirmLabel={t("turnOff")}
        tone="danger"
        loading={busy}
        onConfirm={() => void turnOff()}
        onCancel={() => setTurningOff(false)}
      />
    </>
  );

  return bare ? (
    body
  ) : (
    <Card title={t("title")} description={t("intro")}>
      {body}
    </Card>
  );
};

export default SubscribeCard;
