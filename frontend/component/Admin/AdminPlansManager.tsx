"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  StatusPill,
  Switch,
  Table,
  Textarea,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

type CatalogFeature = { key: string; group: string; label: string };
type CatalogLimit = { key: string; label: string };

type PlanDraft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_half_yearly: number;
  price_yearly: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  is_plan_active: boolean;
};

const PRICE_FIELDS = [
  ["price_monthly", "monthly"],
  ["price_half_yearly", "halfYearly"],
  ["price_yearly", "yearly"],
] as const;

const emptyDraft = (): PlanDraft => ({
  name: "",
  slug: "",
  description: "",
  price_monthly: 0,
  price_half_yearly: 0,
  price_yearly: 0,
  features: {},
  limits: {},
  is_plan_active: true,
});

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Subscription plans: prices, the features each plan unlocks and its usage limits. */
const AdminPlansManager = () => {
  const t = useTranslations("admin");
  const tUi = useTranslations("ui");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [catalog, setCatalog] = useState<{ features: CatalogFeature[]; limits: CatalogLimit[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PlanDraft | null>(null);
  const [deleting, setDeleting] = useState<SubscriptionPlan | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, catalogRes] = await Promise.all([
        axiosReq.get(`${baseUrl}/subscriptions/admin/plans`),
        axiosReq.get(`${baseUrl}/subscriptions/feature-catalog`),
      ]);
      setPlans(plansRes.data?.payload ?? []);
      setCatalog(catalogRes.data?.payload ?? null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const groupedFeatures =
    catalog?.features.reduce<Record<string, CatalogFeature[]>>((acc, feature) => {
      acc[feature.group] = acc[feature.group] ?? [];
      acc[feature.group].push(feature);
      return acc;
    }, {}) ?? {};

  const isNew = !editing?.id;

  const openEdit = (plan: SubscriptionPlan) =>
    setEditing({
      id: plan.id,
      name: plan.name ?? plan.display_name ?? "",
      slug: plan.slug ?? "",
      description: plan.description ?? "",
      price_monthly: Number(plan.price_monthly),
      price_half_yearly: Number(plan.price_half_yearly),
      price_yearly: Number(plan.price_yearly),
      features: { ...(plan.features ?? {}) },
      limits: { ...(plan.limits ?? {}) },
      is_plan_active: plan.is_plan_active,
    });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name || !editing.slug) {
      triggerToast({ title: t("common.missingTitle"), description: t("plans.missing"), type: "error" });
      return;
    }
    setSaving(true);
    const body = {
      name: editing.name,
      slug: editing.slug,
      description: editing.description,
      price_monthly: Number(editing.price_monthly),
      price_half_yearly: Number(editing.price_half_yearly),
      price_yearly: Number(editing.price_yearly),
      features: editing.features,
      limits: editing.limits,
      is_plan_active: editing.is_plan_active,
    };
    try {
      if (isNew) {
        await axiosReq.post(`${baseUrl}/subscriptions/admin/plans`, body);
        triggerToast({ title: t("common.createdTitle"), description: t("plans.created"), type: "success" });
      } else {
        await axiosReq.patch(`${baseUrl}/subscriptions/admin/plans/${editing.id}`, body);
        triggerToast({ title: t("common.savedTitle"), description: t("plans.saved"), type: "success" });
      }
      setEditing(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan: SubscriptionPlan) => {
    const action = plan.is_plan_active ? "deactivate" : "activate";
    try {
      await axiosReq.patch(`${baseUrl}/subscriptions/admin/plans/${plan.id}/${action}`);
      triggerToast({
        title: plan.is_plan_active ? t("plans.disabledTitle") : t("plans.enabledTitle"),
        description: plan.is_plan_active ? t("plans.disabledDetail") : t("plans.enabled"),
        type: "success",
      });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const hardDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await axiosReq.delete(`${baseUrl}/subscriptions/admin/plans/${deleting.id}`);
      triggerToast({ title: t("common.deletedTitle"), description: t("plans.deleted"), type: "success" });
      setDeleting(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<PlanDraft>) => setEditing((current) => (current ? { ...current, ...patch } : current));
  const price = (value: number | string) => `৳${format.number(Number(value))}`;

  const columns: TableColumn<SubscriptionPlan>[] = [
    {
      key: "plan",
      header: t("plans.plan"),
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{row.name ?? row.display_name}</span>
          <span className="text-caption text-ink-muted">{row.slug}</span>
        </span>
      ),
    },
    { key: "monthly", header: t("plans.monthly"), cell: (row) => price(row.price_monthly), align: "right" },
    { key: "half", header: t("plans.halfYearly"), cell: (row) => price(row.price_half_yearly), align: "right", hideOnMobile: true },
    { key: "yearly", header: t("plans.yearly"), cell: (row) => price(row.price_yearly), align: "right", hideOnMobile: true },
    {
      key: "status",
      header: t("common.status"),
      cell: (row) => <StatusPill tone={row.is_plan_active ? "success" : "warning"}>{row.is_plan_active ? t("common.active") : t("common.disabled")}</StatusPill>,
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
            {t("common.edit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void toggleActive(row)}>
            {row.is_plan_active ? t("common.disable") : t("common.enable")}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(row)}>
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("plans.title")} description={t("plans.intro")} actions={<Button onClick={() => setEditing(emptyDraft())}>{t("plans.add")}</Button>} />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table caption={t("plans.title")} columns={columns} rows={plans} getRowId={(row) => row.id} empty={<EmptyState title={t("plans.empty")} />} />
        )}
      </Card>

      <Drawer
        wide
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={isNew ? t("plans.add") : t("plans.editTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {tUi("cancel")}
            </Button>
            <Button type="submit" form="plan-form" loading={saving}>
              {isNew ? t("plans.add") : t("common.save")}
            </Button>
          </>
        }
      >
        {editing ? (
          <form
            id="plan-form"
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={t("common.name")}
                required
                value={editing.name}
                onChange={(event) => update({ name: event.target.value, slug: isNew ? slugify(event.target.value) : editing.slug })}
              />
              <Input
                label={t("plans.slug")}
                required
                hint={t("plans.slugHint")}
                value={editing.slug}
                onChange={(event) => update({ slug: slugify(event.target.value) })}
              />
            </div>
            <Textarea label={t("plans.description")} rows={2} value={editing.description} onChange={(event) => update({ description: event.target.value })} />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-body-sm font-semibold text-ink">{t("plans.prices")}</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PRICE_FIELDS.map(([field, label]) => (
                  <Input
                    key={field}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    label={t(`plans.${label}`)}
                    value={editing[field]}
                    onChange={(event) => update({ [field]: Number(event.target.value) })}
                  />
                ))}
              </div>
            </fieldset>

            {Object.entries(groupedFeatures).map(([group, features]) => (
              <fieldset key={group} className="flex flex-col gap-2">
                <legend className="mb-1 text-body-sm font-semibold text-ink">{group}</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <Switch
                      key={feature.key}
                      label={feature.label}
                      checked={Boolean(editing.features[feature.key])}
                      onChange={(checked) => update({ features: { ...editing.features, [feature.key]: checked } })}
                    />
                  ))}
                </div>
              </fieldset>
            ))}

            {catalog?.limits.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-body-sm font-semibold text-ink">{t("plans.limits")}</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {catalog.limits.map((limit) => (
                    <Input
                      key={limit.key}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      label={limit.label}
                      value={Number(editing.limits[limit.key] ?? 0)}
                      onChange={(event) => update({ limits: { ...editing.limits, [limit.key]: Number(event.target.value) } })}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            <Switch
              label={t("plans.active")}
              hint={t("plans.activeHint")}
              checked={editing.is_plan_active}
              onChange={(checked) => update({ is_plan_active: checked })}
            />
          </form>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={t("common.deleteForever", { name: deleting?.name ?? deleting?.display_name ?? "" })}
        description={t("common.deleteForeverDetail")}
        confirmLabel={t("common.delete")}
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void hardDelete()}
      />
    </div>
  );
};

export default AdminPlansManager;
