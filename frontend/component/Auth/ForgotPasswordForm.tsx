"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";
import useForgotPasswordForm from "@/hooks/auth/useForgotPasswordForm";
import { formatClock } from "@/i18n/format";

const StepIndicator = ({ step }: { step: 1 | 2 | 3 }) => (
  <div className="flex gap-0.5 ml-2">
    {[1, 2, 3].map((item) => (
      <div key={item} className={`w-4 h-1 rounded-sm ${item <= step ? "bg-primary" : "bg-border"}`} />
    ))}
  </div>
);

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
  const locale = useLocale();

  const otpInboxHint =
    deliveryChannel === "email"
      ? t("otp.checkEmail")
      : deliveryChannel === "sms"
        ? t("otp.checkSms")
        : t("otp.checkInbox");

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
      {view === "request" && (
        <>
          <div className="flex flex-row justify-between items-center mb-2">
            <h2 className="text-display font-semibold text-ink capitalize">
              {t("forgot.title")}
            </h2>
            <StepIndicator step={1} />
          </div>
          <p className="text-ink-muted font-normal text-body -mt-4">
            {t("forgot.intro")}
          </p>
          <div className="flex flex-col gap-4">
            <AuthInput
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              formError={identifierError}
              placeholder={t("fields.enterEmailOrPhone")}
              label={t("fields.emailOrPhone")}
            />
            <button
              onClick={handleRequestOtp}
              disabled={requestLoading}
              className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
            >
              <ButtonLoader show={requestLoading} w="w-4" h="h-4" mr="mr-2" />
              {requestLoading ? t("forgot.sending") : t("forgot.send")}
            </button>
          </div>
        </>
      )}

      {view === "otp" && (
        <>
          <div className="flex flex-row justify-between items-center mb-2">
            <h2 className="text-display font-semibold text-ink capitalize">
              {t("otp.title")}
            </h2>
            <StepIndicator step={2} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              {otp.map((val, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  value={val}
                  onChange={(e) => handleOtpChange(index, e.target.value, val)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`w-11 sm:w-12 h-14 text-center text-body font-medium bg-surface rounded-lg focus:outline-none ${
                    otpError ? "ring-2 ring-danger" : "border border-border focus:ring-2 focus:ring-primary"
                  }`}
                />
              ))}
            </div>

            {otpError && (
              <p className="font-normal text-body text-danger">{otpError}</p>
            )}

            <label className="text-ink-muted font-normal text-body mt-2">
              {maskedTarget
                ? t.rich("otp.sentTo", {
                    target: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
                    value: maskedTarget,
                  })
                : t("otp.sent")}{" "}
              {otpInboxHint}
            </label>

            <label className="text-ink-muted font-normal text-body">
              {t("otp.resendIn", { time: formatClock(timeLeft, locale) })}{" "}
              <a
                onClick={timeLeft === 0 ? handleResendCode : undefined}
                style={{ cursor: timeLeft === 0 ? "pointer" : "auto" }}
                className={`font-medium underline ${
                  timeLeft === 0 ? "text-ink cursor-pointer" : "text-ink-muted cursor-default"
                }`}
              >
                {t("otp.resend")}
              </a>
              .
            </label>

            <button
              onClick={handleVerifyOtp}
              disabled={verifyLoading}
              className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
            >
              <ButtonLoader show={verifyLoading} w="w-4" h="h-4" mr="mr-2" />
              {verifyLoading ? t("otp.submitting") : t("otp.submit")}
            </button>
          </div>
        </>
      )}

      {view === "reset" && (
        <>
          <div className="flex flex-row justify-between items-center mb-2">
            <h2 className="text-display font-semibold text-ink capitalize">
              {t("forgot.resetTitle")}
            </h2>
            <StepIndicator step={3} />
          </div>
          <div className="flex flex-col gap-4">
            <AuthInput
              value={password}
              onChange={(e) => handlePasswordChange("password", e.target.value)}
              type="password"
              formError={passwordErrors.password}
              placeholder={t("fields.newPasswordPlaceholder")}
              label={t("fields.newPassword")}
            />
            <AuthInput
              value={confirmPassword}
              onChange={(e) => handlePasswordChange("confirm_password", e.target.value)}
              type="password"
              formError={passwordErrors.confirm_password}
              placeholder={t("fields.confirmNewPasswordPlaceholder")}
              label={t("fields.confirmPassword")}
            />
            <button
              onClick={handleResetPassword}
              disabled={resetLoading}
              className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
            >
              <ButtonLoader show={resetLoading} w="w-4" h="h-4" mr="mr-2" />
              {resetLoading ? t("forgot.resetting") : t("forgot.reset")}
            </button>
          </div>
        </>
      )}

      <p className="mt-2 text-center text-ink-muted text-body">
        {t("forgot.remember")}{" "}
        <Link href="/login" className="text-ink font-medium underline">
          {t("logIn")}
        </Link>
      </p>
    </div>
  );
};

export default ForgotPasswordForm;
