"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, cn, ErrorState, Skeleton } from "@/design/ui";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const TYPES = ["homework", "resources", "video", "other"] as const;

/**
 * The workspace's storage held against its plan, by type (FND-16): a warning from 90%, and at
 * 100% uploads are blocked. Shown to those who manage billing (a solo teacher, a school's owner or admin).
 */
const StorageUsageCard = () => {
  const t = useTranslations("storage");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { canManageBilling } = useBillingAccess();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      axiosReq
        .get<{ payload: StorageUsage }>(`${baseUrl}/files/usage`)
        .then((res) => setUsage(res.data?.payload ?? null))
        .catch(() => setFailed(true)),
    [baseUrl],
  );

  useEffect(() => {
    if (canManageBilling) void load();
  }, [canManageBilling, load]);

  if (!canManageBilling) return null;

  const limited = Boolean(usage?.limit_bytes);

  return (
    <Card title={t("title")} description={t("intro")}>
      {failed ? (
        <ErrorState
          title={t("loadFailed")}
          onRetry={() => {
            setFailed(false);
            void load();
          }}
        />
      ) : !usage ? (
        <Skeleton lines={3} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-title font-semibold text-ink">
              {limited
                ? t("used", { usedSize: format.fileSize(usage.used_bytes), limitSize: format.fileSize(usage.limit_bytes) })
                : t("usedNoLimit", { usedSize: format.fileSize(usage.used_bytes) })}
            </span>
            {usage.full ? (
              <Badge tone="danger">{t("percentUsed", { percent: usage.percent })}</Badge>
            ) : usage.warning ? (
              <Badge tone="warning">{t("percentUsed", { percent: usage.percent })}</Badge>
            ) : null}
          </div>
          {limited ? (
            <div
              role="progressbar"
              aria-label={t("title")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usage.percent}
              className="h-2 overflow-hidden rounded-full bg-canvas"
            >
              <div
                className={cn("h-full rounded-full", usage.full ? "bg-danger" : usage.warning ? "bg-warning" : "bg-primary")}
                style={{ width: `${usage.percent}%` }}
              />
            </div>
          ) : null}
          {usage.full || usage.warning ? (
            <p className={cn("text-body-sm", usage.full ? "text-danger" : "text-warning")}>
              {usage.full ? t("full") : t("warning")}
            </p>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-4">
            {TYPES.map((type) => (
              <div key={type} className="flex flex-col gap-0.5 rounded-input bg-canvas p-3">
                <dt className="text-caption text-ink-muted">{t(`byType.${type}`)}</dt>
                <dd className="text-body-sm font-medium text-ink">{format.fileSize(usage.by_type[type])}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  );
};

export default StorageUsageCard;
