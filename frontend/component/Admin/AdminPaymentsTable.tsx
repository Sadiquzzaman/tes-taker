"use client";

import { useEffect, useState } from "react";
import axiosReq from "@/lib/axios";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  transaction_id?: string;
  created_at: string;
  teacher?: { full_name?: string; email?: string };
};

const AdminPaymentsTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosReq
      .get(`${baseUrl}/subscriptions/admin/payments`)
      .then((res) => setPayments(res.data?.payload ?? []))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  return (
    <div className="rounded-[12px] border border-[#EFF0F3] bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#EFF0F3] text-left">
          <tr>
            <th className="p-3">Teacher</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Status</th>
            <th className="p-3">Transaction</th>
            <th className="p-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-[#747775]">
                Loading...
              </td>
            </tr>
          ) : payments.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-[#747775]">
                No payments yet
              </td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id} className="border-t border-[#EFF0F3]">
                <td className="p-3">{payment.teacher?.full_name ?? payment.teacher?.email ?? "—"}</td>
                <td className="p-3">৳{Number(payment.amount).toLocaleString()}</td>
                <td className="p-3">{payment.status}</td>
                <td className="p-3 font-mono text-xs">{payment.transaction_id ?? "—"}</td>
                <td className="p-3">{new Date(payment.created_at).toLocaleDateString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPaymentsTable;
