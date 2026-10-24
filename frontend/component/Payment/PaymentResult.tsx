import NextLink from "next/link";
import type { ReactNode } from "react";
import { AlertIcon, buttonClasses, CheckIcon, cn, Spinner } from "@/design/ui";

export type PaymentResultTone = "success" | "danger" | "warning" | "busy";

const ICON: Record<PaymentResultTone, { className: string; node: ReactNode }> = {
  success: { className: "bg-success-soft text-success", node: <CheckIcon className="size-6" /> },
  danger: { className: "bg-danger-soft text-danger", node: <AlertIcon className="size-6" /> },
  warning: { className: "bg-warning-soft text-warning", node: <AlertIcon className="size-6" /> },
  busy: { className: "bg-primary-soft text-primary", node: <Spinner className="size-6" /> },
};

/** The page a student or teacher lands on after the payment gateway: what happened, and the way back. */
const PaymentResult = ({
  tone,
  title,
  detail,
  children,
  action,
}: {
  tone: PaymentResultTone;
  title: string;
  detail: string;
  children?: ReactNode;
  action: { href: string; label: string };
}) => (
  <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-card border border-border bg-surface p-6 text-center shadow-card sm:p-8">
      <span className={cn("flex size-12 items-center justify-center rounded-full", ICON[tone].className)}>{ICON[tone].node}</span>
      <div className="flex flex-col gap-1" role={tone === "busy" ? "status" : undefined} aria-live="polite">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        <p className="text-body text-ink-muted">{detail}</p>
      </div>
      {children}
      <NextLink href={action.href} className={buttonClasses({ className: "mt-2" })}>
        {action.label}
      </NextLink>
    </div>
  </main>
);

export const PaymentReference = ({ label, value }: { label: string; value: string }) => (
  <p className="text-caption text-ink-muted">
    {label}: <span className="font-mono">{value}</span>
  </p>
);

export default PaymentResult;
