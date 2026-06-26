"use client";

import { useCallback, useEffect, useState } from "react";
import Switch from "@/Ui/Switch";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";

type CatalogFeature = { key: string; group: string; label: string };
type CatalogLimit = { key: string; label: string };

const AdminPlansManager = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [catalog, setCatalog] = useState<{ features: CatalogFeature[]; limits: CatalogLimit[] } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, catalogRes] = await Promise.all([
        axiosReq.get(`${baseUrl}/subscriptions/admin/plans`),
        axiosReq.get(`${baseUrl}/subscriptions/feature-catalog`),
      ]);
      const planList = plansRes.data?.payload ?? [];
      setPlans(planList);
      setCatalog(catalogRes.data?.payload ?? null);
      if (!selectedPlanId && planList[0]) {
        setSelectedPlanId(planList[0].id);
        setDraft(planList[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [baseUrl, selectedPlanId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (plan) setDraft({ ...plan });
  }, [selectedPlanId, plans]);

  const groupedFeatures = catalog?.features.reduce<Record<string, CatalogFeature[]>>((acc, feature) => {
    acc[feature.group] = acc[feature.group] ?? [];
    acc[feature.group].push(feature);
    return acc;
  }, {}) ?? {};

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await axiosReq.patch(`${baseUrl}/subscriptions/admin/plans/${draft.id}`, {
        name: draft.name ?? draft.display_name,
        slug: draft.slug,
        description: draft.description,
        price_monthly: Number(draft.price_monthly),
        price_half_yearly: Number(draft.price_half_yearly),
        price_yearly: Number(draft.price_yearly),
        features: draft.features,
        limits: draft.limits,
        is_plan_active: draft.is_plan_active,
      });
      triggerToast({ title: "Saved", description: "Plan updated successfully.", type: "success" });
      await loadData();
    } catch {
      triggerToast({ title: "Error", description: "Failed to save plan.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (planId: string) => {
    try {
      await axiosReq.post(`${baseUrl}/subscriptions/admin/plans/${planId}/clone`);
      triggerToast({ title: "Cloned", description: "Plan cloned successfully.", type: "success" });
      await loadData();
    } catch {
      triggerToast({ title: "Error", description: "Failed to clone plan.", type: "error" });
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse bg-[#EFF0F3] rounded-[12px]" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlanId(plan.id)}
            className={`text-left px-4 py-3 rounded-[8px] border ${
              selectedPlanId === plan.id ? "border-[#49734F] bg-[#EAF2EB]" : "border-[#EFF0F3] bg-white"
            }`}
          >
            <p className="font-medium text-[#232A25]">{plan.name ?? plan.display_name}</p>
            <p className="text-xs text-[#747775]">{plan.slug}</p>
          </button>
        ))}
      </div>

      {draft && (
        <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-semibold text-[#232A25]">{draft.name ?? draft.display_name}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleClone(draft.id)}
                className="px-3 py-1.5 text-sm border border-[#49734F] text-[#49734F] rounded-[6px]"
              >
                Clone
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-3 py-1.5 text-sm bg-[#49734F] text-white rounded-[6px] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["price_monthly", "price_half_yearly", "price_yearly"] as const).map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="text-[#747775]">{field.replace("price_", "").replace("_", " ")}</span>
                <input
                  type="number"
                  value={Number(draft[field])}
                  onChange={(e) => setDraft({ ...draft, [field]: Number(e.target.value) })}
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
                      checked={Boolean(draft.features?.[feature.key as keyof typeof draft.features])}
                      onChange={(checked) =>
                        setDraft({
                          ...draft,
                          features: { ...draft.features, [feature.key]: checked },
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
                    value={Number(draft.limits?.[limit.key as keyof typeof draft.limits] ?? 0)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        limits: { ...draft.limits, [limit.key]: Number(e.target.value) },
                      })
                    }
                    className="border border-[#EFF0F3] rounded-[6px] px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </div>

          <Switch
            checked={draft.is_plan_active}
            onChange={(checked) => setDraft({ ...draft, is_plan_active: checked })}
            label="Plan active"
          />
        </div>
      )}
    </div>
  );
};

export default AdminPlansManager;
