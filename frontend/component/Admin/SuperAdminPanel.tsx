"use client";

import { useEffect, useState } from "react";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";

const SuperAdminPanel = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Array<Record<string, unknown>>>([]);
  const [revenue, setRevenue] = useState<Record<string, unknown> | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [planId, setPlanId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    Promise.all([
      axiosReq.get(`${baseUrl}/subscriptions/admin/all-subscriptions`),
      axiosReq.get(`${baseUrl}/subscriptions/super-admin/revenue`),
    ]).then(([subsRes, revenueRes]) => {
      setSubscriptions(subsRes.data?.payload ?? []);
      setRevenue(revenueRes.data?.payload ?? null);
    });
  }, [baseUrl]);

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
    <div className="flex flex-col gap-6">
      <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5">
        <h2 className="font-semibold mb-2">Platform revenue</h2>
        <p className="text-2xl text-[#49734F] font-bold">
          ৳{Number((revenue as { total_revenue?: number })?.total_revenue ?? 0).toLocaleString()}
        </p>
      </div>

      <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5 grid gap-3 max-w-xl">
        <h2 className="font-semibold">Teacher actions</h2>
        <input
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="Teacher UUID"
          className="border border-[#EFF0F3] rounded-[6px] px-3 py-2 text-sm"
        />
        <input
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          placeholder="Plan UUID (optional for temp access)"
          className="border border-[#EFF0F3] rounded-[6px] px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
          className="border border-[#EFF0F3] rounded-[6px] px-3 py-2 text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => void grantTempAccess()} className="px-4 py-2 bg-[#49734F] text-white rounded-[6px] text-sm">
            Grant temp access
          </button>
          <button type="button" onClick={() => void forceChange()} className="px-4 py-2 border border-[#232A25] rounded-[6px] text-sm">
            Force change plan
          </button>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5">
        <h2 className="font-semibold mb-4">Global subscriptions ({subscriptions.length})</h2>
        <div className="max-h-96 overflow-auto text-sm space-y-2">
          {subscriptions.map((sub) => (
            <div key={String(sub.id)} className="flex justify-between border-b border-[#EFF0F3] py-2">
              <span>{String((sub.teacher as { full_name?: string })?.full_name ?? sub.teacher_id)}</span>
              <span>{String((sub.plan as { name?: string })?.name ?? "—")}</span>
              <span>{String(sub.status)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPanel;
