"use client";

import Link from "next/link";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";
import useForgotPasswordForm from "@/hooks/auth/useForgotPasswordForm";
import { formatTime } from "@/utils/auth/helpers";

const StepIndicator = ({ step }: { step: 1 | 2 | 3 }) => (
  <div className="flex gap-0.5 ml-2">
    {[1, 2, 3].map((item) => (
      <div key={item} className={`w-4 h-1 rounded-[2px] ${item <= step ? "bg-[#49734F]" : "bg-[#E5E5E5]"}`} />
    ))}
  </div>
);

const ForgotPasswordForm = () => {
  const {
    view,
    identifier,
    identifierError,
    maskedTarget,
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

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
      {view === "request" && (
        <>
          <div className="flex flex-row justify-between items-center mb-2">
            <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
              Forgot password
            </h2>
            <StepIndicator step={1} />
          </div>
          <p className="text-[#747775] font-normal text-[16px] leading-[125%] tracking-[-0.02em] -mt-4">
            Enter your email or phone number and we'll send you a verification code to reset your password.
          </p>
          <div className="flex flex-col gap-4">
            <AuthInput
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              formError={identifierError}
              placeholder="Enter email or phone"
              label="Email or phone"
            />
            <button
              onClick={handleRequestOtp}
              disabled={requestLoading}
              className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
            >
              <ButtonLoader show={requestLoading} w="w-4" h="h-4" mr="mr-2" />
              {requestLoading ? "Sending code..." : "Send code"}
            </button>
          </div>
        </>
      )}

      {view === "otp" && (
        <>
          <div className="flex flex-row justify-between items-center mb-2">
            <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
              Verify code
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
                  className={`w-11 sm:w-12 h-14 text-center text-[16px] font-medium bg-white rounded-lg focus:outline-none ${
                    otpError ? "ring-2 ring-red-500" : "border border-gray-300 focus:ring-2 focus:ring-green-500"
                  }`}
                />
              ))}
            </div>

            {otpError && (
              <p className="font-normal text-[16px] leading-[125%] tracking-[-0.02em] text-[#D24B44]">{otpError}</p>
            )}

            <label className="text-[#747775] font-normal text-[16px] leading-[125%] tracking-[-0.02em] mt-2">
              We've sent a 6-digit code{maskedTarget ? " to " : ""}
              {maskedTarget && <span className="font-medium text-[#0F1A12]">{maskedTarget}</span>}. Please check your SMS
              inbox and email.
            </label>

            <label className="text-[#747775] font-normal text-[16px] leading-[125%] tracking-[-0.02em]">
              Resend available in {formatTime(timeLeft)}{" "}
              <a
                onClick={timeLeft === 0 ? handleResendCode : undefined}
                style={{ cursor: timeLeft === 0 ? "pointer" : "auto" }}
                className={`font-medium underline ${
                  timeLeft === 0 ? "text-[#232A25] cursor-pointer" : "text-gray-400 cursor-default"
                }`}
              >
                Resend code
              </a>
              .
            </label>

            <button
              onClick={handleVerifyOtp}
              disabled={verifyLoading}
              className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
            >
              <ButtonLoader show={verifyLoading} w="w-4" h="h-4" mr="mr-2" />
              {verifyLoading ? "Verifying..." : "Verify & Continue"}
            </button>
          </div>
        </>
      )}

      {view === "reset" && (
        <>
          <div className="flex flex-row justify-between items-center mb-2">
            <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
              Set new password
            </h2>
            <StepIndicator step={3} />
          </div>
          <div className="flex flex-col gap-4">
            <AuthInput
              value={password}
              onChange={(e) => handlePasswordChange("password", e.target.value)}
              type="password"
              formError={passwordErrors.password}
              placeholder="Enter new password"
              label="New password"
            />
            <AuthInput
              value={confirmPassword}
              onChange={(e) => handlePasswordChange("confirm_password", e.target.value)}
              type="password"
              formError={passwordErrors.confirm_password}
              placeholder="Confirm new password"
              label="Confirm password"
            />
            <button
              onClick={handleResetPassword}
              disabled={resetLoading}
              className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
            >
              <ButtonLoader show={resetLoading} w="w-4" h="h-4" mr="mr-2" />
              {resetLoading ? "Updating..." : "Reset password"}
            </button>
          </div>
        </>
      )}

      <p className="mt-2 text-center text-[#747775] text-[16px]">
        Remember your password?{" "}
        <Link href="/login" className="text-[#232A25] font-medium underline">
          Log In
        </Link>
      </p>
    </div>
  );
};

export default ForgotPasswordForm;
