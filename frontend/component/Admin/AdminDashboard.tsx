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

const StatCard = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-white p-4 rounded-[12px] flex flex-col justify-between w-full h-full min-h-[120px]">
    <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">{label}</div>
    <div className="text-[32px] font-[600] leading-[36px] tracking-[-0.04em] text-[#49734F]">{value}</div>
  </div>
);

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
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Platform</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Overview
          </p>
        </div>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-162px)]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          <StatCard label="Active subscribers" value={loading ? "—" : stats?.total_active_subscribers ?? 0} />
          <StatCard label="Expiring (30 days)" value={loading ? "—" : stats?.expiring_count ?? 0} />
          <StatCard
            label="Plans in use"
            value={loading ? "—" : stats?.subscribers_by_plan?.length ?? 0}
          />
        </div>

        <div className="bg-white p-4 rounded-[12px] flex flex-col gap-3 min-h-[200px]">
          <div className="font-[500] text-[16px] leading-[20px] text-[#232A25] tracking-[-0.02em]">
            Subscribers by plan
          </div>
          <div className="flex flex-col gap-2">
            {loading ? (
              <p className="text-[#747775] text-sm py-4">Loading...</p>
            ) : stats?.subscribers_by_plan?.length ? (
              stats.subscribers_by_plan.map((row) => (
                <div
                  key={row.slug}
                  className="flex justify-between items-center text-sm border-b border-[#EFF0F3] py-2 last:border-b-0"
                >
                  <span className="text-[#232A25]">{row.plan_name}</span>
                  <span className="font-[500] text-[#49734F]">{row.count}</span>
                </div>
              ))
            ) : (
              <p className="text-[#747775] text-sm py-4">No subscribers yet</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href="/admin/plans" className="px-4 h-[40px] flex items-center rounded-[8px] bg-[#49734F] text-white text-sm font-[500]">
            Manage plans
          </Link>
          <Link
            href="/admin/payments"
            className="px-4 h-[40px] flex items-center rounded-[8px] border border-[#49734F] text-[#49734F] text-sm font-[500]"
          >
            View payments
          </Link>
          <Link
            href="/admin/super"
            className="px-4 h-[40px] flex items-center rounded-[8px] bg-[#232A25] text-white text-sm font-[500]"
          >
            Super admin
          </Link>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
