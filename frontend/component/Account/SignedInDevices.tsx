"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, ConfirmDialog, ErrorState, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

export type SignedInDevice = {
  id: string;
  platform: "WEB" | "ANDROID" | "IOS";
  device_name: string | null;
  app_version: string | null;
  created_at: string;
  last_used_at: string;
  current: boolean;
};

/** "Signed-in devices" (PM-01): where the account is signed in; sign out one device or all the others. */
const SignedInDevices = () => {
  const t = useTranslations("account.devices");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [devices, setDevices] = useState<SignedInDevice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<SignedInDevice | "others" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await axiosReq.get<{ payload: SignedInDevice[] }>(`${baseUrl}/auth/sessions`);
      setDevices(res.data?.payload ?? []);
    } catch {
      setFailed(true);
    }
  }, [baseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      if (confirming === "others") {
        const res = await axiosReq.post<{ payload: { signed_out: number } }>(`${baseUrl}/auth/sessions/revoke-others`, {});
        triggerToast({ title: t("doneTitle"), description: t("othersDone", { count: res.data?.payload?.signed_out ?? 0 }), type: "success" });
      } else {
        await axiosReq.delete(`${baseUrl}/auth/sessions/${confirming.id}`);
        triggerToast({ title: t("doneTitle"), description: t("oneDone"), type: "success" });
      }
      setConfirming(null);
      await load();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (device: SignedInDevice) => device.device_name || t(`platform.${device.platform}`);
  const others = (devices ?? []).filter((device) => !device.current);

  return (
    <Card title={t("title")} description={t("intro")}>
      {failed ? (
        <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
      ) : devices === null ? (
        <Skeleton lines={3} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col" aria-label={t("title")}>
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink">
                    <span className="break-words">{nameOf(device)}</span>
                    {device.current ? <Badge tone="success">{t("thisDevice")}</Badge> : null}
                  </p>
                  <p className="text-body-sm text-ink-muted">
                    {t(`platform.${device.platform}`)}
                    {device.app_version ? ` · ${t("appVersion", { version: device.app_version })}` : ""}
                    {" · "}
                    {t("lastUsed", { when: format.dateTime(device.last_used_at) })}
                  </p>
                </div>
                {device.current ? null : (
                  <Button variant="secondary" size="sm" className="self-start sm:self-center" onClick={() => setConfirming(device)}>
                    {t("signOut")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {others.length > 0 ? (
            <Button variant="danger" className="self-end" onClick={() => setConfirming("others")}>
              {t("signOutOthers")}
            </Button>
          ) : (
            <p className="text-body-sm text-ink-muted">{t("onlyThisOne")}</p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming !== null}
        tone="danger"
        title={confirming === "others" ? t("othersConfirmTitle", { count: others.length }) : t("oneConfirmTitle", { name: confirming ? nameOf(confirming) : "" })}
        description={t("confirmDetail")}
        confirmLabel={t("signOut")}
        loading={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void signOut()}
      />
    </Card>
  );
};

export default SignedInDevices;
