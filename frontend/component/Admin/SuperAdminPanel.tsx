"use client";

import { useEffect, useMemo, useState } from "react";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";

type SubscriptionRow = {
  id: string;
  teacher_id?: string;
  status?: string;
  teacher?: { full_name?: string };
  plan?: { name?: string };
};

const StatCard = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-white p-4 rounded-[12px] flex flex-col justify-between w-full h-full min-h-[120px]">
    <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">{label}</div>
    <div className="text-[32px] font-[600] leading-[36px] tracking-[-0.04em] text-[#49734F]">{value}</div>
  </div>
);

const SuperAdminPanel = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [planId, setPlanId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    axiosReq
      .get(`${baseUrl}/subscriptions/admin/all-subscriptions`)
      .then((res) => setSubscriptions(res.data?.payload ?? []))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const teachers = new Set(subscriptions.map((s) => s.teacher_id).filter(Boolean)).size;
    const plans = new Set(subscriptions.map((s) => s.plan?.name).filter(Boolean)).size;
    return {
      total: subscriptions.length,
      active,
      teachers,
      plans,
    };
  }, [subscriptions]);

  const grantTempAccess = async () => {
    if (!teacherId) return;
    try {
      await axiosReq.post(`${baseUrl}/subscriptions/super-admin/grant-temp-access`, {
        teacher_id: teacherId,
        plan_id: planId || undefined,
        expires_at: expiresAt || undefined,
      });
      triggerToast({ title: "Granted", description: "Temporary access applied.", type: "success" });
    } catch {
      triggerToast({ title: "Error", description: "Failed to grant access.", type: "error" });
    }
  };

  const forceChange = async () => {
    if (!teacherId || !planId) return;
    try {
      await axiosReq.post(`${baseUrl}/subscriptions/super-admin/teacher/${teacherId}/force-change`, {
        plan_id: planId,
        billing_cycle: "MONTHLY",
      });
      triggerToast({ title: "Updated", description: "Plan force-changed.", type: "success" });
    } catch {
      triggerToast({ title: "Error", description: "Failed to change plan.", type: "error" });
    }
  };

  return (
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Super</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Admin
          </p>
        </div>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-162px)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <StatCard label="Total Subscriptions" value={loading ? "—" : stats.total} />
          <StatCard label="Active" value={loading ? "—" : stats.active} />
          <StatCard label="Teachers" value={loading ? "—" : stats.teachers} />
          <StatCard label="Plans In Use" value={loading ? "—" : stats.plans} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          <div className="bg-white p-4 rounded-[12px] flex flex-col gap-3">
            <div className="font-[500] text-[16px] leading-[20px] text-[#232A25] tracking-[-0.02em]">
              Teacher actions
            </div>
            <input
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              placeholder="Teacher UUID"
              className="border border-[#EFF0F3] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#49734F]"
            />
            <input
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              placeholder="Plan UUID (optional for temp access)"
              className="border border-[#EFF0F3] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#49734F]"
            />
            <input
              type="datetime-local"
              value={expiresAt ? expiresAt.slice(0, 16) : ""}
              onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
              className="border border-[#EFF0F3] rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:border-[#49734F]"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void grantTempAccess()}
                className="px-4 h-[40px] bg-[#49734F] text-white rounded-[8px] text-sm font-[500]"
              >
                Grant temp access
              </button>
              <button
                type="button"
                onClick={() => void forceChange()}
                className="px-4 h-[40px] bg-[#232A25] text-white rounded-[8px] text-sm font-[500]"
              >
                Force change plan
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-[12px] flex flex-col gap-3 min-h-[240px]">
            <div className="flex items-center justify-between">
              <div className="font-[500] text-[16px] leading-[20px] text-[#232A25] tracking-[-0.02em]">
                Global subscriptions
              </div>
              <span className="text-[12px] text-[#747775]">{subscriptions.length} total</span>
            </div>
            <div className="flex-1 max-h-[320px] overflow-auto text-sm">
              {loading ? (
                <p className="text-[#747775] text-center py-6">Loading...</p>
              ) : subscriptions.length === 0 ? (
                <p className="text-[#747775] text-center py-6">No subscriptions yet</p>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-2 border-b border-[#EFF0F3] py-2 last:border-b-0"
                  >
                    <span className="truncate text-[#232A25]">{sub.teacher?.full_name ?? sub.teacher_id}</span>
                    <span className="text-[#49734F]">{sub.plan?.name ?? "—"}</span>
                    <span
                      className={`text-[12px] px-2 py-0.5 rounded-full ${
                        sub.status === "ACTIVE" ? "bg-[#EAF2EB] text-[#49734F]" : "bg-[#EFF0F3] text-[#747775]"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SuperAdminPanel;
