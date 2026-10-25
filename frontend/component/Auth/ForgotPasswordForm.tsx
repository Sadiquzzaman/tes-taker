"use client";

import { useTranslations } from "next-intl";
import { Button, Input, PasswordInput } from "@/design/ui";
import useForgotPasswordForm from "@/hooks/auth/useForgotPasswordForm";
import AuthFooterLink from "./AuthFooterLink";
import AuthHeading from "./AuthHeading";
import OtpInput from "./OtpInput";
import ResendCode from "./ResendCode";

/** Reset a forgotten password in three steps: send a code, enter it, set a new password. */
const ForgotPasswordForm = () => {
  const {
    view,
    identifier,
    identifierError,
    maskedTarget,
    deliveryChannel,
    otp,
    otpError,
    timeLeft,
    inputsRef,
    password,
    confirmPassword,
    passwordErrors,
    requestLoading,
    verifyLoading,
    resetLoading,
    handleIdentifierChange,
    handleRequestOtp,
    handleResendCode,
    handleOtpChange,
    handleOtpKeyDown,
    handleVerifyOtp,
    handlePasswordChange,
    handleResetPassword,
  } = useForgotPasswordForm();
  const t = useTranslations("auth");

  const inboxHint = deliveryChannel === "email" ? t("otp.checkEmail") : deliveryChannel === "sms" ? t("otp.checkSms") : t("otp.checkInbox");
  const submit = (action: () => unknown) => (event: React.FormEvent) => {
    event.preventDefault();
    void action();
  };

  return (
    <>
      {view === "request" ? (
        <>
          <AuthHeading title={t("forgot.title")} step={1} steps={3}>
            <p className="text-body text-ink-muted">{t("forgot.intro")}</p>
          </AuthHeading>
          <form noValidate className="flex flex-col gap-4" onSubmit={submit(handleRequestOtp)}>
            <Input
              label={t("fields.emailOrPhone")}
              autoComplete="username"
              placeholder={t("fields.enterEmailOrPhone")}
              value={identifier}
              error={identifierError || undefined}
              onChange={(event) => handleIdentifierChange(event.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={requestLoading}>
              {t("forgot.send")}
            </Button>
          </form>
        </>
      ) : null}

      {view === "otp" ? (
        <>
          <AuthHeading title={t("otp.title")} step={2} steps={3}>
            <p className="text-body text-ink-muted">
              {maskedTarget
                ? t.rich("otp.sentTo", { target: (chunks) => <span className="font-medium text-ink">{chunks}</span>, value: maskedTarget })
                : t("otp.sent")}{" "}
              {inboxHint}
            </p>
          </AuthHeading>
          <form noValidate className="flex flex-col gap-4" onSubmit={submit(handleVerifyOtp)}>
            <OtpInput otp={otp} error={otpError || undefined} inputsRef={inputsRef} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} />
            <ResendCode timeLeft={timeLeft} onResend={handleResendCode} />
            <Button type="submit" size="lg" fullWidth loading={verifyLoading}>
              {t("otp.submit")}
            </Button>
          </form>
        </>
      ) : null}

      {view === "reset" ? (
        <>
          <AuthHeading title={t("forgot.resetTitle")} step={3} steps={3} />
          <form noValidate className="flex flex-col gap-4" onSubmit={submit(handleResetPassword)}>
            <PasswordInput
              label={t("fields.newPassword")}
              autoComplete="new-password"
              placeholder={t("fields.newPasswordPlaceholder")}
              value={password}
              error={passwordErrors.password || undefined}
              onChange={(event) => handlePasswordChange("password", event.target.value)}
            />
            <PasswordInput
              label={t("fields.confirmPassword")}
              autoComplete="new-password"
              placeholder={t("fields.confirmNewPasswordPlaceholder")}
              value={confirmPassword}
              error={passwordErrors.confirm_password || undefined}
              onChange={(event) => handlePasswordChange("confirm_password", event.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={resetLoading}>
              {t("forgot.reset")}
            </Button>
          </form>
        </>
      ) : null}

      <AuthFooterLink text={t("forgot.remember")} href="/login" label={t("logIn")} />
    </>
  );
};

export default ForgotPasswordForm;
