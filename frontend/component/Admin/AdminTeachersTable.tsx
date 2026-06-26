"use client";

import { useEffect, useMemo, useState } from "react";
import axiosReq from "@/lib/axios";

type SubscriptionRow = {
  id: string;
  teacher_id?: string;
  status?: string;
  billing_cycle?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  teacher?: { full_name?: string; email?: string; phone?: string };
  plan?: { name?: string };
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const AdminTeachersTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axiosReq
      .get(`${baseUrl}/subscriptions/admin/all-subscriptions`)
      .then((res) => setSubscriptions(res.data?.payload ?? []))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  // One row per teacher: prefer the active subscription, otherwise the latest one.
  const teacherRows = useMemo(() => {
    const byTeacher = new Map<string, SubscriptionRow>();
    for (const sub of subscriptions) {
      const key = sub.teacher_id ?? sub.id;
      const existing = byTeacher.get(key);
      if (!existing) {
        byTeacher.set(key, sub);
      } else if (existing.status !== "ACTIVE" && sub.status === "ACTIVE") {
        byTeacher.set(key, sub);
      }
    }
    return Array.from(byTeacher.values());
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teacherRows;
    return teacherRows.filter((row) => (row.teacher?.full_name ?? "").toLowerCase().includes(q));
  }, [teacherRows, search]);

  return (
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Teacher</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Details
          </p>
        </div>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teacher by name..."
          className="border border-[#EFF0F3] bg-white rounded-[8px] px-3 py-2 text-sm max-w-sm focus:outline-none focus:border-[#49734F]"
        />

        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Teacher</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Started</th>
                <th className="p-3">Ends</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#747775]">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#747775]">
                    No teachers found
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t border-[#EFF0F3]">
                    <td className="p-3 text-[#232A25]">{row.teacher?.full_name ?? "—"}</td>
                    <td className="p-3 text-[#747775]">{row.teacher?.email ?? row.teacher?.phone ?? "—"}</td>
                    <td className="p-3 text-[#49734F]">{row.plan?.name ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={`text-[12px] px-2 py-0.5 rounded-full ${
                          row.status === "ACTIVE" ? "bg-[#EAF2EB] text-[#49734F]" : "bg-[#EFF0F3] text-[#747775]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3">{formatDate(row.start_date ?? row.created_at)}</td>
                    <td className="p-3">{formatDate(row.end_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AdminTeachersTable;
