"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import axiosReq from "@/lib/axios";

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const verify = async () => {
      const tranId = searchParams.get("tran_id");
      const valId = searchParams.get("val_id");

      if (!tranId) {
        setStatus("error");
        setMessage("Missing transaction reference.");
        return;
      }

      try {
        await axiosReq.post(`${baseUrl}/payments/verify`, { transactionId: tranId, valId });
        setStatus("success");
        setMessage("Payment successful! Your subscription is now active.");
      } catch {
        setStatus("error");
        setMessage("Payment verification failed. Contact support if you were charged.");
      }
    };

    void verify();
  }, [baseUrl, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EFF0F3] px-6">
      <div className="max-w-md w-full bg-white rounded-[12px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#232A25] mb-2">
          {status === "loading" ? "Processing..." : status === "success" ? "Payment successful" : "Payment issue"}
        </h1>
        <p className="text-[#747775] mb-6">{message}</p>
        <Link href="/account" className="inline-block px-6 py-2.5 rounded-[8px] bg-[#49734F] text-white">
          Go to account
        </Link>
      </div>
    </div>
  );
}
