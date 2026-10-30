"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorState, Link, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

/**
 * The workspace's SMS credits (FND-13): this month's allowance from the plan, top-ups that carry
 * over, and packs to buy. Shown to those who manage billing (a solo teacher, a school's owner or admin).
 */
const SmsCreditsCard = () => {
  const t = useTranslations("smsCredits");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { canManageBilling } = useBillingAccess();
  const { handleError } = useApiError();
  const [summary, setSummary] = useState<SmsCreditSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await axiosReq.get<{ payload: SmsCreditSummary }>(`${baseUrl}/sms-credits`);
      setSummary(res.data?.payload ?? null);
    } catch {
      setFailed(true);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (canManageBilling) void load();
  }, [canManageBilling, load]);

  /** The server prices the pack; only its id is sent. */
  const buy = async (pack: SmsTopUpPack) => {
    setBuying(pack.id);
    try {
      const res = await axiosReq.post(`${baseUrl}/payments/sms-top-up`, { packId: pack.id });
      const gatewayUrl = res.data?.payload?.gatewayPageUrl;
      if (!gatewayUrl) throw new Error("No gateway URL returned");
      window.location.href = gatewayUrl;
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setBuying(null);
    }
  };

  if (!canManageBilling) return null;

  return (
    <Card title={t("title")} description={t("intro")} actions={<Link href="/message-log">{t("openLog")}</Link>}>
      <div className="flex flex-col gap-4">
        {failed ? (
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        ) : !summary ? (
          <Skeleton lines={3} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-title font-semibold text-ink">
                {t("totalLeft", { count: summary.total_left })}
              </span>
              {summary.low ? <Badge tone="warning">{t("low")}</Badge> : null}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5 rounded-input bg-canvas p-3">
                <dt className="text-caption text-ink-muted">{t("allowance")}</dt>
                <dd className="text-body-sm font-medium text-ink">
                  {summary.allowance.granted
                    ? t("allowanceLeft", { left: summary.allowance.left, granted: summary.allowance.granted })
                    : t("noAllowance")}
                </dd>
                <dd className="text-caption text-ink-muted">{t("allowanceHint")}</dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-input bg-canvas p-3">
                <dt className="text-caption text-ink-muted">{t("topUp")}</dt>
                <dd className="text-body-sm font-medium text-ink">{t("credits", { count: summary.top_up.left })}</dd>
                <dd className="text-caption text-ink-muted">{t("topUpHint")}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              <h3 className="text-body-sm font-semibold text-ink">{t("buyHeading")}</h3>
              <ul className="grid gap-2 sm:grid-cols-3">
                {summary.packs.map((pack) => (
                  <li key={pack.id} className="flex flex-col gap-2 rounded-input border border-border p-3">
                    <span className="text-body-sm font-semibold text-ink">{t("credits", { count: pack.credits })}</span>
                    <span className="text-caption text-ink-muted">
                      {t("price", { price: format.number(pack.price) })}
                    </span>
                    <Button
                      size="sm"
                      loading={buying === pack.id}
                      disabled={Boolean(buying)}
                      aria-label={t("buyPack", { count: pack.credits })}
                      onClick={() => void buy(pack)}
                    >
                      {t("buy")}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-caption text-ink-muted">{t("noCreditHint")}</p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default SmsCreditsCard;
