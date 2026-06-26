"use client";

import { useEffect, useMemo, useState } from "react";
import axiosReq from "@/lib/axios";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  billing_cycle?: string;
  transaction_id?: string;
  created_at: string;
  teacher?: { full_name?: string; email?: string };
  plan?: { name?: string };
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const statusStyle = (status: string) => {
  if (status === "COMPLETED") return "bg-[#EAF2EB] text-[#49734F]";
  if (status === "PENDING") return "bg-[#FFF4E5] text-[#B54708]";
  return "bg-[#FDECEA] text-[#C0392B]";
};

const AdminPaymentsTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axiosReq
      .get(`${baseUrl}/subscriptions/admin/payments?limit=200`)
      .then((res) => setPayments(res.data?.payload ?? []))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => (p.teacher?.full_name ?? "").toLowerCase().includes(q));
  }, [payments, search]);

  const totalPaid = useMemo(
    () =>
      filtered
        .filter((p) => p.status === "COMPLETED")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [filtered],
  );

  return (
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Payment</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Details
          </p>
        </div>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teacher by name..."
            className="border border-[#EFF0F3] bg-white rounded-[8px] px-3 py-2 text-sm max-w-sm w-full focus:outline-none focus:border-[#49734F]"
          />
          <p className="text-sm text-[#747775]">
            Collected (completed): <strong className="text-[#49734F]">৳{totalPaid.toLocaleString()}</strong>
          </p>
        </div>

        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Teacher</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Transaction</th>
                <th className="p-3">Date</th>
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
                    No payments found
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr key={payment.id} className="border-t border-[#EFF0F3]">
                    <td className="p-3">
                      <p className="text-[#232A25]">{payment.teacher?.full_name ?? "—"}</p>
                      <p className="text-xs text-[#747775]">{payment.teacher?.email ?? ""}</p>
                    </td>
                    <td className="p-3 text-[#49734F]">{payment.plan?.name ?? "—"}</td>
                    <td className="p-3">৳{Number(payment.amount).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`text-[12px] px-2 py-0.5 rounded-full ${statusStyle(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{payment.transaction_id ?? "—"}</td>
                    <td className="p-3">{formatDate(payment.created_at)}</td>
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

export default AdminPaymentsTable;
