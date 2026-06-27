"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import axiosReq from "@/lib/axios";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

type PaymentView = {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  subscriptionId?: string;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 8;

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [phase, setPhase] = useState<"loading" | "settled" | "pending" | "error">("loading");
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [message, setMessage] = useState("Confirming your payment...");

  const fetchPayment = useCallback(
    async (tranId: string): Promise<PaymentView | null> => {
      const res = await axiosReq.get(`${baseUrl}/payments/${encodeURIComponent(tranId)}`);
      return (res.data?.payload as PaymentView) ?? null;
    },
    [baseUrl],
  );

  useEffect(() => {
    const tranId = searchParams.get("tran_id");

    if (!tranId) {
      setPhase("error");
      setMessage("Missing transaction reference.");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const result = await fetchPayment(tranId);
        if (cancelled) return;

        if (result) {
          setPayment(result);

          if (result.status === "PAID") {
            setPhase("settled");
            setMessage("Payment successful! Your subscription is now active.");
            return;
          }

          if (result.status === "FAILED" || result.status === "CANCELLED") {
            setPhase("error");
            setMessage(
              result.status === "CANCELLED"
                ? "This payment was cancelled."
                : "This payment did not go through.",
            );
            return;
          }
        }

        if (attempts >= MAX_POLLS) {
          setPhase("pending");
          setMessage("Payment is still being confirmed. This can take a moment.");
          return;
        }

        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        if (attempts >= MAX_POLLS) {
          setPhase("error");
          setMessage("We couldn't confirm your payment. Contact support if you were charged.");
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [fetchPayment, searchParams]);

  const heading =
    phase === "settled"
      ? "Payment successful"
      : phase === "error"
        ? "Payment issue"
        : phase === "pending"
          ? "Payment processing"
          : "Processing...";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EFF0F3] px-6">
      <div className="max-w-md w-full bg-white rounded-[12px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#232A25] mb-2">{heading}</h1>
        <p className="text-[#747775] mb-6">{message}</p>

        {payment && (
          <dl className="text-left text-sm bg-[#F7F8F9] rounded-[8px] p-4 mb-6 space-y-2">
            <div className="flex justify-between">
              <dt className="text-[#747775]">Status</dt>
              <dd className="font-medium text-[#232A25]">{payment.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#747775]">Amount</dt>
              <dd className="font-medium text-[#232A25]">
                {payment.currency} {Number(payment.amount).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#747775]">Payment method</dt>
              <dd className="font-medium text-[#232A25]">{payment.paymentMethod ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#747775]">Subscription</dt>
              <dd className="font-medium text-[#232A25]">
                {payment.status === "PAID" ? "Activated" : "Pending"}
              </dd>
            </div>
          </dl>
        )}

        <Link href="/account" className="inline-block px-6 py-2.5 rounded-[8px] bg-[#49734F] text-white">
          Go to account
        </Link>
      </div>
    </div>
  );
}
