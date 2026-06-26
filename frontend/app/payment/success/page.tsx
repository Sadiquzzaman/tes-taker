import { Suspense } from "react";
import PaymentSuccessContent from "@/component/Payment/PaymentSuccessContent";

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#EFF0F3]">
          <p className="text-[#747775]">Verifying payment...</p>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
