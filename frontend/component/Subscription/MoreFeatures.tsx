"use client";

import { AxiosError } from "axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, buttonClasses, Card, ErrorState, Modal, Skeleton, Textarea } from "@/design/ui";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import { useApiError } from "@/hooks/api/useApiError";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import axiosReq from "@/lib/axios";
import useFeatureNames from "./useFeatureNames";

/**
 * "More features" (FND-08): every plan feature with a short description, what the current workspace
 * has, and for locked ones "Request this feature" (stored for the platform admin). Owners and admins
 * can also upgrade from here.
 */
const MoreFeatures = () => {
  const t = useTranslations("features.page");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { canManageBilling } = useBillingAccess();
  const { entitlements, loading: entitlementsLoading, error: entitlementsError, refetch } = useEntitlements();
  const { featureName, featureDescription, groupName } = useFeatureNames();
  const [catalog, setCatalog] = useState<FeatureCatalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [requesting, setRequesting] = useState<CatalogFeature | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(() => new Set());

  const loadCatalog = useCallback(async () => {
    setCatalogFailed(false);
    try {
      const res = await axiosReq.get<{ payload: FeatureCatalog }>(`${baseUrl}/subscriptions/feature-catalog`);
      setCatalog(res.data?.payload ?? null);
    } catch {
      setCatalogFailed(true);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, CatalogFeature[]>();
    for (const feature of catalog?.features ?? []) {
      byGroup.set(feature.group, [...(byGroup.get(feature.group) ?? []), feature]);
    }
    return [...byGroup.entries()];
  }, [catalog]);

  const sendRequest = async () => {
    if (!requesting) return;
    setSending(true);
    try {
      await axiosReq.post(`${baseUrl}/me/feature-requests`, { feature_key: requesting.key, note: note.trim() || undefined });
      setRequested((prev) => new Set(prev).add(requesting.key));
      triggerToast({
        title: t("sentTitle"),
        description: t("sent", { name: featureName(requesting.key, requesting.label) }),
        type: "success",
      });
      setRequesting(null);
      setNote("");
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSending(false);
    }
  };

  if (catalogFailed || entitlementsError) {
    return (
      <ErrorState
        title={t("loadFailed")}
        onRetry={() => {
          void loadCatalog();
          void refetch();
        }}
      />
    );
  }

  if (!catalog || entitlementsLoading) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canManageBilling ? (
        <Card
          title={t("planTitle", { plan: entitlements?.plan?.name ?? t("free") })}
          description={t("upgradeHint")}
          actions={
            <Link href="/billing" className={buttonClasses({ size: "sm" })}>
              {t("upgrade")}
            </Link>
          }
        />
      ) : null}

      {groups.map(([group, features]) => (
        <Card key={group} title={groupName(group)}>
          <ul className="flex flex-col divide-y divide-border">
            {features.map((feature) => {
              const included = Boolean(entitlements?.features?.[feature.key]);
              const name = featureName(feature.key, feature.label);
              const description = featureDescription(feature.key, feature.description);
              return (
                <li key={feature.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-body font-medium text-ink">{name}</p>
                    {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {included ? (
                      <Badge tone="success">{t("included")}</Badge>
                    ) : requested.has(feature.key) ? (
                      <Badge tone="info">{t("requested")}</Badge>
                    ) : (
                      <>
                        <Badge>{t("locked")}</Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={t("requestFor", { name })}
                          onClick={() => {
                            setNote("");
                            setRequesting(feature);
                          }}
                        >
                          {t("request")}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      <Modal
        open={Boolean(requesting)}
        onClose={() => setRequesting(null)}
        title={t("requestTitle", { name: requesting ? featureName(requesting.key, requesting.label) : "" })}
        description={t("requestDetail")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequesting(null)}>
              {t("cancel")}
            </Button>
            <Button loading={sending} onClick={() => void sendRequest()}>
              {t("send")}
            </Button>
          </>
        }
      >
        <Textarea label={t("note")} hint={t("noteHint")} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </Modal>
    </div>
  );
};

export default MoreFeatures;
