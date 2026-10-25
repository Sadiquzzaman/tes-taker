"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/design/ui";
import { useVerifyCode } from "@/hooks/auth/useVerifyCode";
import { maskInputValue } from "@/utils/auth/helpers";
import AuthHeading from "./AuthHeading";
import OtpInput from "./OtpInput";
import ResendCode from "./ResendCode";

/** Step 2 of signup: the six-digit code sent to the phone or email. */
const VerifyCode = ({ value, successTitle, successDescription }: VerifyCodeProps) => {
  const { otp, timeLeft, loading, formError, inputsRef, handleChange, handleKeyDown, handleVerifyAndContinue, handleResendCode } =
    useVerifyCode(value, { successTitle, successDescription });
  const t = useTranslations("auth.otp");
  const isEmail = value.includes("@");

  return (
    <>
      <AuthHeading title={t("title")} step={2} steps={2}>
        <p className="text-body text-ink-muted">
          {t.rich("sentTo", { target: (chunks) => <span className="font-medium text-ink">{chunks}</span>, value: maskInputValue(value) })}{" "}
          {isEmail ? t("checkSpam") : t("checkSms")}
        </p>
      </AuthHeading>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleVerifyAndContinue();
        }}
      >
        <OtpInput otp={otp} error={formError || undefined} inputsRef={inputsRef} onChange={handleChange} onKeyDown={handleKeyDown} />
        <ResendCode timeLeft={timeLeft} onResend={handleResendCode} />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t("submit")}
        </Button>
      </form>
    </>
  );
};

export default VerifyCode;
