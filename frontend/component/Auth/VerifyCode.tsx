import { useVerifyCode } from "@/hooks/auth/useVerifyCode";
import { maskInputValue, formatTime } from "@/utils/auth/helpers";
import ButtonLoader from "../Loader/ButtonLoadder";

interface VerifyCodeProps {
  value: string;
}

const VerifyCode = ({ value }: VerifyCodeProps) => {
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
  } = useVerifyCode(value);

  const isEmail = value.includes("@");

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Verify code</h2>
        <div className="flex">
          <div className="w-4 h-1 rotate-0 opacity-100 rounded-[2px] bg-[#E5E5E5] mr-1" />
          <div className="w-4 h-1 rotate-0 opacity-100 rounded-[2px] bg-[#49734F]" />
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
            className={`w-11 sm:w-12 h-14 text-center text-[16px] font-medium bg-white rounded-lg focus:outline-none ${
              formError ? "ring-2 ring-red-500" : "border border-gray-300 focus:ring-2 focus:ring-green-500"
            } mb-2`}
          />
        ))}
      </div>

      {formError && (
        <p className="font-normal text-[16px] leading-[125%] tracking-[-0.02em] text-[#D24B44] align-middle">
          {formError}
        </p>
      )}

      <label className="text-[#747775] font-normal text-[16px] leading-[125%] tracking-[-0.02em] my-2">
        We’ve sent a 6-digit code to <span className="font-medium text-[#0F1A12]">{maskInputValue(value)}</span>.
        {isEmail ? " Don’t forget to check the spam folder." : " Please check your SMS inbox."}
      </label>

      <label className="text-[#747775] font-normal text-[16px] leading-[125%] tracking-[-0.02em] my-2">
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
        onClick={handleVerifyAndContinue}
        className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium mb-4 hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
        disabled={loading}
      >
        <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
        {loading ? "Verifying..." : "Verify & Continue"}
      </button>
    </>
  );
};

export default VerifyCode;
