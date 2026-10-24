import Link from "next/link";

export default async function PaymentFailPage({ searchParams }: { searchParams: Promise<{ tran_id?: string }> }) {
  const { tran_id } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="max-w-md w-full bg-surface rounded-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink mb-2">Payment failed</h1>
        <p className="text-ink-muted mb-2">Your payment could not be completed. Please try again.</p>
        {tran_id && (
          <p className="text-xs text-[#9AA09B] mb-6">
            Reference: <span className="font-mono">{tran_id}</span>
          </p>
        )}
        <Link href="/account" className="inline-block px-6 py-2.5 rounded-input bg-primary text-ink-inverse">
          Back to billing
        </Link>
      </div>
    </div>
  );
}
