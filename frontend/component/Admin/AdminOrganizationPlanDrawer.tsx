"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import useFeatureNames from "@/component/Subscription/useFeatureNames";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, DatePicker, Drawer, ErrorState, Input, Select, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const CYCLES: BillingCycle[] = ["MONTHLY", "HALF_YEARLY", "YEARLY"];

/** The end of the chosen day, so an override set "until 30 Nov" still counts on 30 Nov. */
export const expiryFromDate = (date: string) => (date ? new Date(`${date}T23:59:59`).toISOString() : undefined);

/**
 * A platform admin's view of one organisation's plan (FND-07): assign a plan, switch each feature
 * on or off and set each limit, optionally until a date. Overrides win over the plan until they
 * expire or are reset.
 */
const AdminOrganizationPlanDrawer = ({ organization, onClose }: { organization: AdminOrganizationItem | null; onClose: () => void }) => {
  const t = useTranslations("admin.organizationPlan");
  const tBilling = useTranslations("billing");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { featureName, limitName, groupName } = useFeatureNames();
  const [data, setData] = useState<AdminOrganizationEntitlements | null>(null);
  const [catalog, setCatalog] = useState<FeatureCatalog | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [expiresOn, setExpiresOn] = useState("");
  const [reason, setReason] = useState("");
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const organizationId = organization?.id;

  const loadEntitlements = useCallback(async () => {
    if (!organizationId) return;
    const res = await axiosReq.get<{ payload: AdminOrganizationEntitlements }>(
      `${baseUrl}/subscriptions/admin/organizations/${organizationId}/entitlements`,
    );
    setData(res.data?.payload ?? null);
  }, [baseUrl, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    setData(null);
    setFailed(false);
    setLimitDrafts({});
    setExpiresOn("");
    setReason("");
    Promise.all([
      loadEntitlements(),
      axiosReq.get<{ payload: FeatureCatalog }>(`${baseUrl}/subscriptions/feature-catalog`).then((res) => setCatalog(res.data?.payload ?? null)),
      axiosReq.get<{ payload: SubscriptionPlan[] }>(`${baseUrl}/subscriptions/admin/plans`).then((res) => setPlans(res.data?.payload ?? [])),
    ]).catch(() => setFailed(true));
  }, [baseUrl, loadEntitlements, organizationId]);

  const currentPlan = useMemo(() => plans.find((plan) => plan.id === data?.entitlements.plan.id), [data, plans]);
  const overrideByKey = useMemo(() => new Map((data?.overrides ?? []).map((override) => [override.key, override])), [data]);
  const featureGroups = useMemo(() => {
    const byGroup = new Map<string, CatalogFeature[]>();
    for (const feature of catalog?.features ?? []) byGroup.set(feature.group, [...(byGroup.get(feature.group) ?? []), feature]);
    return [...byGroup.entries()];
  }, [catalog]);

  /** Runs one change, then reloads what the organisation may use now. */
  const run = async (key: string, action: () => Promise<unknown>) => {
    setSaving(key);
    try {
      await action();
      await loadEntitlements();
      triggerToast({ title: t("savedTitle"), description: t("saved"), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(null);
    }
  };

  const overrideUrl = (key: string) => `${baseUrl}/subscriptions/admin/organizations/${organizationId}/overrides/${encodeURIComponent(key)}`;

  const setOverride = (key: string, value: boolean | number) =>
    run(key, () => axiosReq.put(overrideUrl(key), { value, expires_at: expiryFromDate(expiresOn), reason: reason.trim() || undefined }));

  const resetOverride = (key: string) =>
    run(key, async () => {
      await axiosReq.delete(overrideUrl(key));
      setLimitDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });

  const assignPlan = () =>
    run("plan", () => axiosReq.post(`${baseUrl}/subscriptions/admin/assign`, { organization_id: organizationId, plan_id: planId, billing_cycle: cycle }));

  const onOff = (value: boolean | undefined) => (value ? t("on") : t("off"));
  const untilText = (override?: FeatureOverrideItem) =>
    override?.expires_at ? t("until", { date: format.date(override.expires_at) }) : override ? t("noExpiry") : null;

  const body = () => {
    if (failed) return <ErrorState title={t("loadFailed")} />;
    if (!data || !catalog) return <Skeleton lines={8} />;
    const { entitlements } = data;
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3" aria-labelledby="org-plan-heading">
          <h3 id="org-plan-heading" className="text-title-sm font-semibold text-ink">
            {t("planHeading")}
          </h3>
          <p className="text-body-sm text-ink-muted">
            {t("currentPlan", { plan: entitlements.plan.name })}
            {entitlements.subscription?.end_date ? ` · ${t("until", { date: format.date(entitlements.subscription.end_date) })}` : ""}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Select
              label={t("plan")}
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              placeholder={t("choosePlan")}
              options={plans.map((plan) => ({ value: plan.id, label: plan.name ?? plan.display_name ?? plan.slug ?? plan.id }))}
            />
            <Select
              label={tBilling("cycle")}
              value={cycle}
              placeholder={false}
              onChange={(event) => setCycle(event.target.value as BillingCycle)}
              options={CYCLES.map((value) => ({ value, label: tBilling(`cycles.${value}`) }))}
            />
            <Button disabled={!planId || Boolean(saving)} loading={saving === "plan"} onClick={() => void assignPlan()}>
              {t("assign")}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-input bg-canvas p-3" aria-label={t("changeOptions")}>
          <p className="text-body-sm text-ink-muted">{t("changeOptionsHint")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePicker label={t("expiresOn")} hint={t("expiresHint")} value={expiresOn} onChange={setExpiresOn} />
            <Input label={t("reason")} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </div>
        </section>

        {featureGroups.map(([group, features]) => (
          <section key={group} className="flex flex-col gap-2">
            <h3 className="text-title-sm font-semibold text-ink">{groupName(group)}</h3>
            <ul className="flex flex-col divide-y divide-border">
              {features.map((feature) => {
                const override = overrideByKey.get(feature.key);
                const name = featureName(feature.key, feature.label);
                const planValue = Boolean(currentPlan?.features?.[feature.key]);
                const choice = override ? (override.value ? "on" : "off") : "plan";
                return (
                  <li key={feature.key} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-body-sm font-medium text-ink">{name}</span>
                      <span className="text-caption text-ink-muted">
                        {t("effective", { value: onOff(entitlements.features?.[feature.key]) })}
                        {override ? ` · ${untilText(override)}` : ""}
                      </span>
                    </div>
                    <Select
                      label={t("switchFor", { name })}
                      hideLabel
                      fieldClassName="sm:w-52"
                      placeholder={false}
                      disabled={Boolean(saving)}
                      value={choice}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "plan") void resetOverride(feature.key);
                        else void setOverride(feature.key, next === "on");
                      }}
                      options={[
                        { value: "plan", label: t("planDefault", { value: onOff(planValue) }) },
                        { value: "on", label: t("on") },
                        { value: "off", label: t("off") },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <h3 className="text-title-sm font-semibold text-ink">{t("limitsHeading")}</h3>
          <p className="text-body-sm text-ink-muted">{t("limitsHint")}</p>
          <ul className="flex flex-col divide-y divide-border">
            {catalog.limits.map((limit) => {
              const override = overrideByKey.get(limit.key);
              const name = limitName(limit.key, limit.label);
              const planValue = Number(currentPlan?.limits?.[limit.key] ?? 0);
              const draft = limitDrafts[limit.key] ?? (override ? String(override.value) : "");
              const effective = Number(entitlements.limits?.[limit.key] ?? 0);
              return (
                <li key={limit.key} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-body-sm font-medium text-ink">{name}</span>
                    <span className="text-caption text-ink-muted">
                      {t("effective", { value: effective ? format.number(effective) : t("noLimit") })}
                      {override ? ` · ${untilText(override)}` : ` · ${t("fromPlan")}`}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <Input
                      label={t("limitFor", { name })}
                      hideLabel
                      type="number"
                      min={0}
                      inputMode="numeric"
                      fieldClassName="w-28"
                      placeholder={planValue ? String(planValue) : t("noLimit")}
                      value={draft}
                      onChange={(event) => setLimitDrafts((prev) => ({ ...prev, [limit.key]: event.target.value }))}
                    />
                    <Button
                      size="sm"
                      disabled={draft === "" || Number(draft) < 0 || Boolean(saving)}
                      loading={saving === limit.key}
                      aria-label={t("saveFor", { name })}
                      onClick={() => void setOverride(limit.key, Number(draft))}
                    >
                      {t("save")}
                    </Button>
                    {override ? (
                      <Button size="sm" variant="ghost" disabled={Boolean(saving)} aria-label={t("resetFor", { name })} onClick={() => void resetOverride(limit.key)}>
                        {t("reset")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  };

  return (
    <Drawer
      wide
      open={Boolean(organization)}
      onClose={onClose}
      title={t("title", { name: organization?.name ?? "" })}
      description={organization?.kind === "SOLO" ? <Badge>{t("solo")}</Badge> : undefined}
    >
      {body()}
    </Drawer>
  );
};

export default AdminOrganizationPlanDrawer;
