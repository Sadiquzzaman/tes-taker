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
  if (status === "COMPLETED") return "bg-primary-soft text-primary";
  if (status === "PENDING") return "bg-warning-soft text-warning";
  return "bg-danger-soft text-danger";
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
    () => filtered.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0),
    [filtered],
  );

  return (
    <>
      <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
        <div className="text-title-sm md:text-display tracking-tight flex items-center gap-0 flex-wrap mr-4">
          <p className="font-medium text-ink">Payment</p>
          <p className="font-normal text-primary italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            Details
          </p>
        </div>
      </div>

      <div className="bg-canvas rounded-card p-2 sm:p-4 min-h-[calc(100vh-162px)] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teacher by name..."
            className="border border-border bg-surface rounded-input px-3 py-2 text-sm max-w-sm w-full focus:outline-none focus:border-primary"
          />
          <p className="text-sm text-ink-muted">
            Collected (completed): <strong className="text-primary">৳{totalPaid.toLocaleString()}</strong>
          </p>
        </div>

        <div className="bg-surface rounded-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-ink">
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
                  <td colSpan={6} className="p-6 text-center text-ink-muted">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink-muted">
                    No payments found
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="p-3">
                      <p className="text-ink">{payment.teacher?.full_name ?? "—"}</p>
                      <p className="text-xs text-ink-muted">{payment.teacher?.email ?? ""}</p>
                    </td>
                    <td className="p-3 text-primary">{payment.plan?.name ?? "—"}</td>
                    <td className="p-3">৳{Number(payment.amount).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`text-caption px-2 py-0.5 rounded-full ${statusStyle(payment.status)}`}>
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
