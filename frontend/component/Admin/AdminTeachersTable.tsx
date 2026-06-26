"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";

type SubscriptionRow = {
  id: string;
  teacher_id?: string;
  status?: string;
  billing_cycle?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  teacher?: { full_name?: string; email?: string; phone?: string; is_active?: number };
  plan?: { name?: string };
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const isTeacherActive = (value?: number) => value === 1 || value === undefined;

const AdminTeachersTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get(`${baseUrl}/subscriptions/admin/all-subscriptions`);
      setSubscriptions(res.data?.payload ?? []);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const toggleTeacherStatus = async (teacherId: string, active: boolean) => {
    setTogglingId(teacherId);
    try {
      await axiosReq.patch(`${baseUrl}/subscriptions/admin/teacher/${teacherId}/status`, { active });
      triggerToast({
        title: active ? "Teacher enabled" : "Teacher disabled",
        description: active
          ? "The teacher can log in again."
          : "The teacher can no longer log in.",
        type: "success",
      });
      await loadData();
    } catch {
      triggerToast({
        title: "Error",
        description: "Failed to update teacher status.",
        type: "error",
      });
    } finally {
      setTogglingId(null);
    }
  };

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
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#747775]">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#747775]">
                    No teachers found
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const teacherId = row.teacher_id ?? "";
                  const active = isTeacherActive(row.teacher?.is_active);

                  return (
                    <tr key={row.id} className="border-t border-[#EFF0F3]">
                      <td className="p-3 text-[#232A25]">{row.teacher?.full_name ?? "—"}</td>
                      <td className="p-3 text-[#747775]">{row.teacher?.email ?? row.teacher?.phone ?? "—"}</td>
                      <td className="p-3 text-[#49734F]">{row.plan?.name ?? "—"}</td>
                      <td className="p-3">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-full ${
                            active ? "bg-[#EAF2EB] text-[#49734F]" : "bg-[#FDECEA] text-[#C0392B]"
                          }`}
                        >
                          {active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="p-3">{formatDate(row.start_date ?? row.created_at)}</td>
                      <td className="p-3">{formatDate(row.end_date)}</td>
                      <td className="p-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={!teacherId || togglingId === teacherId}
                            onClick={() => void toggleTeacherStatus(teacherId, !active)}
                            className={`px-3 py-1.5 text-xs rounded-[6px] disabled:opacity-60 ${
                              active
                                ? "border border-[#C0392B] text-[#C0392B]"
                                : "bg-[#49734F] text-white"
                            }`}
                          >
                            {togglingId === teacherId ? "Saving..." : active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AdminTeachersTable;
