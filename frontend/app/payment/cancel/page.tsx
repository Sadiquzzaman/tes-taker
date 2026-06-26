import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EFF0F3] px-6">
      <div className="max-w-md w-full bg-white rounded-[12px] p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#232A25] mb-2">Payment cancelled</h1>
        <p className="text-[#747775] mb-6">You cancelled the payment. No charges were made.</p>
        <Link href="/account" className="inline-block px-6 py-2.5 rounded-[8px] bg-[#49734F] text-white">
          Back to billing
        </Link>
      </div>
    </div>
  );
}
