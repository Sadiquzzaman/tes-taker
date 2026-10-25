"use client";

import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";

/** "Resend available in 01:30", then a Resend code button once the timer runs out. */
const ResendCode = ({ timeLeft, onResend }: { timeLeft: number; onResend: () => void }) => {
  const t = useTranslations("auth.otp");
  const format = useFormat();
  return timeLeft > 0 ? (
    <p className="text-body-sm text-ink-muted">
      {t("resendIn", { time: format.clock(timeLeft) })}
    </p>
  ) : (
    <button type="button" onClick={onResend} className="self-start text-body-sm font-medium text-primary underline underline-offset-2">
      {t("resend")}
    </button>
  );
};

export default ResendCode;
