"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axiosReq from "@/lib/axios";

type AdminStats = {
  total_active_subscribers: number;
  total_revenue: number;
  expiring_count: number;
  subscribers_by_plan: Array<{ plan_name: string; slug: string; count: number }>;
};

const AdminDashboard = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosReq
      .get(`${baseUrl}/subscriptions/admin/stats`)
      .then((res) => setStats(res.data?.payload ?? null))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-[#232A25]">Platform overview</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[12px] bg-[#EFF0F3] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5">
              <p className="text-sm text-[#747775]">Active subscribers</p>
              <p className="text-3xl font-bold text-[#49734F]">{stats?.total_active_subscribers ?? 0}</p>
            </div>
            <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5">
              <p className="text-sm text-[#747775]">Total revenue</p>
              <p className="text-3xl font-bold text-[#49734F]">৳{Number(stats?.total_revenue ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5">
              <p className="text-sm text-[#747775]">Expiring (30 days)</p>
              <p className="text-3xl font-bold text-[#49734F]">{stats?.expiring_count ?? 0}</p>
            </div>
          </div>

          <div className="rounded-[12px] border border-[#EFF0F3] bg-white p-5">
            <h2 className="font-semibold text-[#232A25] mb-4">Subscribers by plan</h2>
            <div className="space-y-2">
              {stats?.subscribers_by_plan?.map((row) => (
                <div key={row.slug} className="flex justify-between text-sm">
                  <span>{row.plan_name}</span>
                  <span className="font-medium">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-4 flex-wrap">
        <Link href="/admin/plans" className="px-4 py-2 rounded-[8px] bg-[#49734F] text-white text-sm">
          Manage plans
        </Link>
        <Link href="/admin/payments" className="px-4 py-2 rounded-[8px] border border-[#49734F] text-[#49734F] text-sm">
          View payments
        </Link>
        <Link href="/admin/super" className="px-4 py-2 rounded-[8px] border border-[#232A25] text-[#232A25] text-sm">
          Super admin
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
