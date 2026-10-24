"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
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
// The lookup is private: only the logged-in account that paid can see it.
const NOT_VISIBLE_STATUSES = [401, 403, 404];
const NOT_VISIBLE_MESSAGE =
  "Log in with the account that made this payment to see its status. / এই পেমেন্টের অবস্থা দেখতে যে অ্যাকাউন্ট থেকে পেমেন্ট করেছেন সেটিতে লগ ইন করুন।";
const MAX_POLLS = 8;

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const tranId = searchParams.get("tran_id");
  const [pollPhase, setPhase] = useState<"loading" | "settled" | "pending" | "error">("loading");
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [pollMessage, setMessage] = useState("Confirming your payment...");
  // Without a transaction reference there is nothing to poll.
  const phase = tranId ? pollPhase : "error";
  const message = tranId ? pollMessage : "Missing transaction reference.";

  const fetchPayment = useCallback(
    async (tranId: string): Promise<PaymentView | null> => {
      const res = await axiosReq.get(`${baseUrl}/payments/${encodeURIComponent(tranId)}`);
      return (res.data?.payload as PaymentView) ?? null;
    },
    [baseUrl],
  );

  useEffect(() => {
    if (!tranId) {
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
              result.status === "CANCELLED" ? "This payment was cancelled." : "This payment did not go through.",
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
      } catch (error) {
        if (cancelled) return;
        if (isAxiosError(error) && NOT_VISIBLE_STATUSES.includes(error.response?.status ?? 0)) {
          setPhase("error");
          setMessage(NOT_VISIBLE_MESSAGE);
          return;
        }
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
  }, [fetchPayment, tranId]);

  const heading =
    phase === "settled"
      ? "Payment successful"
      : phase === "error"
        ? "Payment issue"
        : phase === "pending"
          ? "Payment processing"
          : "Processing...";

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="max-w-md w-full bg-surface rounded-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink mb-2">{heading}</h1>
        <p className="text-ink-muted mb-6">{message}</p>

        {payment && (
          <dl className="text-left text-sm bg-canvas rounded-input p-4 mb-6 space-y-2">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Status</dt>
              <dd className="font-medium text-ink">{payment.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Amount</dt>
              <dd className="font-medium text-ink">
                {payment.currency} {Number(payment.amount).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Payment method</dt>
              <dd className="font-medium text-ink">{payment.paymentMethod ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subscription</dt>
              <dd className="font-medium text-ink">{payment.status === "PAID" ? "Activated" : "Pending"}</dd>
            </div>
          </dl>
        )}

        <Link href="/account" className="inline-block px-6 py-2.5 rounded-input bg-primary text-ink-inverse">
          Go to account
        </Link>
      </div>
    </div>
  );
}
