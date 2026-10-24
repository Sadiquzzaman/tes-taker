import { useLocale, useTranslations } from "next-intl";
import { useVerifyCode } from "@/hooks/auth/useVerifyCode";
import { formatClock } from "@/i18n/format";
import { maskInputValue } from "@/utils/auth/helpers";
import ButtonLoader from "../Loader/ButtonLoadder";

const VerifyCode = ({ value, successTitle, successDescription }: VerifyCodeProps) => {
  const {
    otp,
    timeLeft,
    loading,
    formError,
    inputsRef,
    handleChange,
    handleKeyDown,
    handleVerifyAndContinue,
    handleResendCode,
  } = useVerifyCode(value, { successTitle, successDescription });

  const t = useTranslations("auth.otp");
  const locale = useLocale();
  const isEmail = value.includes("@");

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-ink">{t("title")}</h2>
        <div className="flex">
          <div className="w-4 h-1 rotate-0 opacity-100 rounded-sm bg-border mr-1" />
          <div className="w-4 h-1 rotate-0 opacity-100 rounded-sm bg-primary" />
        </div>
      </div>

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
            onChange={(e) => handleChange(index, e.target.value, val)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className={`w-11 sm:w-12 h-14 text-center text-body font-medium bg-surface rounded-lg focus:outline-none ${
              formError ? "ring-2 ring-danger" : "border border-border focus:ring-2 focus:ring-primary"
            } mb-2`}
          />
        ))}
      </div>

      {formError && (
        <p className="font-normal text-body text-danger align-middle">
          {formError}
        </p>
      )}

      <label className="text-ink-muted font-normal text-body my-2">
        {t.rich("sentTo", {
          target: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
          value: maskInputValue(value),
        })}{" "}
        {isEmail ? t("checkSpam") : t("checkSms")}
      </label>

      <label className="text-ink-muted font-normal text-body my-2">
        {t("resendIn", { time: formatClock(timeLeft, locale) })}{" "}
        <a
          onClick={timeLeft === 0 ? handleResendCode : undefined}
          style={{ cursor: timeLeft === 0 ? "pointer" : "auto" }}
          className={`font-medium underline ${
            timeLeft === 0 ? "text-ink cursor-pointer" : "text-ink-muted cursor-default"
          }`}
        >
          {t("resend")}
        </a>
        .
      </label>

      <button
        onClick={handleVerifyAndContinue}
        className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium mb-4 hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
        disabled={loading}
      >
        <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
        {loading ? t("submitting") : t("submit")}
      </button>
    </>
  );
};

export default VerifyCode;
