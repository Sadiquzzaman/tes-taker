import { Suspense } from "react";
import PaymentSuccessContent from "@/component/Payment/PaymentSuccessContent";

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-canvas">
          <p className="text-ink-muted">Verifying payment...</p>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
