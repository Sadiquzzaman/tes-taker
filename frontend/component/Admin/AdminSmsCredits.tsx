"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Input, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

/** A platform admin adds top-up SMS credits to an organisation (FND-13); each top-up is audited. */
const AdminSmsCredits = ({ organizationId, onChanged }: { organizationId: string; onChanged?: () => void }) => {
  const t = useTranslations("admin.smsCredits");
  const tCredits = useTranslations("smsCredits");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [summary, setSummary] = useState<SmsCreditSummary | null>(null);
  const [credits, setCredits] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosReq.get<{ payload: SmsCreditSummary }>(`${baseUrl}/sms-credits/admin/${organizationId}`);
      setSummary(res.data?.payload ?? null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    setSummary(null);
    void load();
  }, [load]);

  const amount = Number(credits);
  const valid = Number.isInteger(amount) && amount > 0;

  const add = async () => {
    setSaving(true);
    try {
      const res = await axiosReq.post<{ payload: SmsCreditSummary }>(`${baseUrl}/sms-credits/admin/${organizationId}/top-ups`, {
        credits: amount,
        reason: reason.trim() || undefined,
      });
      setSummary(res.data?.payload ?? null);
      setCredits("");
      setReason("");
      triggerToast({ title: t("addedTitle"), description: t("added", { count: amount }), type: "success" });
      onChanged?.();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby="org-sms-heading">
      <h3 id="org-sms-heading" className="text-title-sm font-semibold text-ink">
        {t("heading")}
      </h3>
      {summary ? (
        <p className="text-body-sm text-ink-muted">
          {t("balance", {
            total: summary.total_left,
            allowance: summary.allowance.left,
            granted: summary.allowance.granted,
            topUp: summary.top_up.left,
          })}
          {summary.low ? ` · ${tCredits("low")}` : ""}
        </p>
      ) : (
        <Skeleton lines={1} />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          label={t("credits")}
          type="number"
          min={1}
          inputMode="numeric"
          fieldClassName="sm:w-32"
          value={credits}
          onChange={(event) => setCredits(event.target.value)}
        />
        <Input label={t("reason")} fieldClassName="sm:flex-1" value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button disabled={!valid || saving} loading={saving} onClick={() => void add()}>
          {t("add")}
        </Button>
      </div>
    </section>
  );
};

export default AdminSmsCredits;
