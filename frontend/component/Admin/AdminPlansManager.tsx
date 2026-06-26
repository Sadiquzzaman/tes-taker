"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import Switch from "@/Ui/Switch";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";

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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const AdminPlansManager = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [catalog, setCatalog] = useState<{ features: CatalogFeature[]; limits: CatalogLimit[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PlanDraft | null>(null);
  const [isNew, setIsNew] = useState(false);

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

  const openCreate = () => {
    setIsNew(true);
    setEditing(emptyDraft());
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setIsNew(false);
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
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name || !editing.slug) {
      triggerToast({ title: "Missing fields", description: "Name and slug are required.", type: "error" });
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
        triggerToast({ title: "Created", description: "Plan created successfully.", type: "success" });
      } else {
        await axiosReq.patch(`${baseUrl}/subscriptions/admin/plans/${editing.id}`, body);
        triggerToast({ title: "Saved", description: "Plan updated successfully.", type: "success" });
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
        title: plan.is_plan_active ? "Disabled" : "Enabled",
        description: `Plan ${plan.is_plan_active ? "disabled" : "enabled"}.`,
        type: "success",
      });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  const hardDelete = async (plan: SubscriptionPlan) => {
    const ok = window.confirm(
      `Permanently delete "${plan.name ?? plan.display_name}"? This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await axiosReq.delete(`${baseUrl}/subscriptions/admin/plans/${plan.id}`);
      triggerToast({ title: "Deleted", description: "Plan permanently deleted.", type: "success" });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Subscription</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Plans
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center gap-2 h-[40px] px-4 bg-[#232A25] rounded-xl font-[500] text-white text-[14px]"
        >
          + Add plan
        </button>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)]">
        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Plan</th>
                <th className="p-3">Monthly</th>
                <th className="p-3">Half-yearly</th>
                <th className="p-3">Yearly</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#747775]">
                    Loading...
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#747775]">
                    No plans yet
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id} className="border-t border-[#EFF0F3]">
                    <td className="p-3">
                      <p className="font-medium text-[#232A25]">{plan.name ?? plan.display_name}</p>
                      <p className="text-xs text-[#747775]">{plan.slug}</p>
                    </td>
                    <td className="p-3">৳{Number(plan.price_monthly).toLocaleString()}</td>
                    <td className="p-3">৳{Number(plan.price_half_yearly).toLocaleString()}</td>
                    <td className="p-3">৳{Number(plan.price_yearly).toLocaleString()}</td>
                    <td className="p-3">
                      <span
                        className={`text-[12px] px-2 py-0.5 rounded-full ${
                          plan.is_plan_active ? "bg-[#EAF2EB] text-[#49734F]" : "bg-[#FFF4E5] text-[#B54708]"
                        }`}
                      >
                        {plan.is_plan_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => openEdit(plan)}
                          className="px-3 py-1.5 text-xs border border-[#49734F] text-[#49734F] rounded-[6px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(plan)}
                          className="px-3 py-1.5 text-xs border border-[#B54708] text-[#B54708] rounded-[6px]"
                        >
                          {plan.is_plan_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void hardDelete(plan)}
                          className="px-3 py-1.5 text-xs bg-[#C0392B] text-white rounded-[6px]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[12px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#232A25]">{isNew ? "Add plan" : "Edit plan"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-[#747775] text-xl leading-none">
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[#747775]">Name</span>
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                      slug: isNew ? slugify(e.target.value) : editing.slug,
                    })
                  }
                  className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[#747775]">Slug</span>
                <input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[#747775]">Description</span>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={2}
                className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["price_monthly", "price_half_yearly", "price_yearly"] as const).map((field) => (
                <label key={field} className="flex flex-col gap-1 text-sm">
                  <span className="text-[#747775] capitalize">{field.replace("price_", "").replace("_", " ")}</span>
                  <input
                    type="number"
                    value={editing[field]}
                    onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                    className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
                  />
                </label>
              ))}
            </div>

            {Object.entries(groupedFeatures).map(([group, features]) => (
              <div key={group}>
                <h3 className="font-semibold text-[#232A25] mb-3">{group}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between gap-3 text-sm">
                      <span>{feature.label}</span>
                      <Switch
                        checked={Boolean(editing.features[feature.key])}
                        onChange={(checked) =>
                          setEditing({
                            ...editing,
                            features: { ...editing.features, [feature.key]: checked },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="font-semibold text-[#232A25] mb-3">Limits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catalog?.limits.map((limit) => (
                  <label key={limit.key} className="flex flex-col gap-1 text-sm">
                    <span className="text-[#747775]">{limit.label}</span>
                    <input
                      type="number"
                      value={Number(editing.limits[limit.key] ?? 0)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          limits: { ...editing.limits, [limit.key]: Number(e.target.value) },
                        })
                      }
                      className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            </div>

            <Switch
              checked={editing.is_plan_active}
              onChange={(checked) => setEditing({ ...editing, is_plan_active: checked })}
              label="Plan active"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 h-[40px] rounded-[8px] border border-[#EFF0F3] text-[#232A25] text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-4 h-[40px] rounded-[8px] bg-[#49734F] text-white text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : isNew ? "Create plan" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPlansManager;
