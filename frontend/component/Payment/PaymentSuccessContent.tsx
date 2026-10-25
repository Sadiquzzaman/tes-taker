"use client";

import { isAxiosError } from "axios";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import PaymentResult, { PaymentReference, type PaymentResultTone } from "./PaymentResult";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

type PaymentView = {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  subscriptionId?: string;
};

type Outcome = "checking" | "paid" | "pending" | "cancelled" | "failed" | "notVisible" | "unconfirmed";

const POLL_INTERVAL_MS = 2000;
// The lookup is private: only the logged-in account that paid can see it.
const NOT_VISIBLE_STATUSES = [401, 403, 404];
const MAX_POLLS = 8;

/** After the gateway says "success", checks the payment with the server until it settles. */
export default function PaymentSuccessContent() {
  const t = useTranslations("payment");
  const format = useFormat();
  const tranId = useSearchParams().get("tran_id");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [outcome, setOutcome] = useState<Outcome>("checking");
  const [payment, setPayment] = useState<PaymentView | null>(null);

  const fetchPayment = useCallback(
    async (id: string): Promise<PaymentView | null> => {
      const res = await axiosReq.get(`${baseUrl}/payments/${encodeURIComponent(id)}`);
      return (res.data?.payload as PaymentView) ?? null;
    },
    [baseUrl],
  );

  useEffect(() => {
    if (!tranId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const result = await fetchPayment(tranId);
        if (cancelled) return;
        if (result) {
          setPayment(result);
          if (result.status === "PAID") return setOutcome("paid");
          if (result.status === "CANCELLED") return setOutcome("cancelled");
          if (result.status === "FAILED") return setOutcome("failed");
        }
        if (attempts >= MAX_POLLS) return setOutcome("pending");
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        if (isAxiosError(error) && NOT_VISIBLE_STATUSES.includes(error.response?.status ?? 0)) return setOutcome("notVisible");
        if (attempts >= MAX_POLLS) return setOutcome("unconfirmed");
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [fetchPayment, tranId]);

  // Without a transaction reference there is nothing to check.
  const shown = tranId ? outcome : "missingReference";
  const { tone, title, detail }: { tone: PaymentResultTone; title: string; detail: string } =
    shown === "checking"
      ? { tone: "busy", title: t("checking.title"), detail: t("checking.detail") }
      : shown === "paid"
        ? { tone: "success", title: t("paid.title"), detail: t("paid.detail") }
        : shown === "pending"
          ? { tone: "warning", title: t("pending.title"), detail: t("pending.detail") }
          : { tone: "danger", title: t("issue.title"), detail: t(`issue.${shown}`) };

  return (
    <PaymentResult tone={tone} title={title} detail={detail} action={{ href: "/account", label: t("goToAccount") }}>
      {payment ? (
        <dl className="flex w-full flex-col gap-2 rounded-input bg-canvas p-4 text-left text-body-sm">
          {(
            [
              ["status", t(`statuses.${payment.status}`)],
              ["amount", `${payment.currency} ${format.number(Number(payment.amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
              ["method", payment.paymentMethod ?? "—"],
              ["subscription", payment.status === "PAID" ? t("active") : t("waiting")],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t(key)}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tranId ? <PaymentReference label={t("reference")} value={tranId} /> : null}
    </PaymentResult>
  );
}
