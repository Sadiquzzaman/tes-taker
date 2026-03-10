import { useRef, useState, useEffect } from "react";
import { useToast } from "../Toast/ToastContext";
import axios from "axios";
import ButtonLoader from "../Loader/ButtonLoadder";

const length = 6;
const OTP_TIME = 60;
const VeriyCode = ({ value }: { value: string }) => {
  const { push } = require("next/navigation").useRouter();
  const { triggerToast } = useToast();
  const [formError, setFormError] = useState("");
  const [otp, setOtp] = useState(Array(length).fill(""));
  const [timeLeft, setTimeLeft] = useState(OTP_TIME);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    startTimer();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleChange = (index: number, value: string, prevValue: string) => {
    if (!/^\d*$/.test(value)) return;

    setFormError("");

    let newValue = "";
    if (value.length === 1) newValue = value;
    else if (value.length === 2 && prevValue === value[0]) newValue = value[1];
    else if (value.length === 2 && prevValue === value[1]) newValue = value[0];

    const newOtp = [...otp];
    newOtp[index] = newValue;
    setOtp(newOtp);

    if (newValue && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const focusInput = (targetIndex: number) => {
    const input = inputsRef.current[targetIndex];
    if (!input) return;

    input.focus();

    requestAnimationFrame(() => {
      const len = input.value.length;
      input.setSelectionRange(len, len);
    });
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const lastIndex = otp.length - 1;

    switch (e.key) {
      case "Backspace":
        if (!otp[index] && index > 0) {
          e.preventDefault();
          focusInput(index - 1);
        }
        break;

      case "ArrowLeft":
        if (index > 0) {
          e.preventDefault();
          focusInput(index - 1);
        }
        break;

      case "ArrowRight":
        if (index < lastIndex) {
          e.preventDefault();
          focusInput(index + 1);
        }
        break;
    }
  };

  const handleVirifyAndContinue = async () => {
    if (otp.some((digit) => digit === "")) {
      setFormError("Please enter the complete OTP code");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/auth/register/verify-otp`,
        {
          phone: value,
          otp: otp.join(""),
        },
        {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      setLoading(false);
      triggerToast({
        title: "Code Verified",
        description: response.data?.message || "OTP verified successfully.",
        type: "success",
      });

      push("/login");
    } catch (err: any) {
      setLoading(false);
      const message = err?.response?.data?.message || "OTP verification failed. Please try again.";
      triggerToast({
        title: "Verification Failed",
        description: message,
        type: "error",
      });
    }
  };

  const maskInputValue = (email: string) => {
    if (email.length <= 6) return email; // not enough to mask safely

    const firstPart = email.slice(0, 3);
    const lastPart = email.slice(-3);
    const middleLength = email.length - 6;

    const maskedSection = "*".repeat(middleLength);

    return firstPart + maskedSection + lastPart;
  };

  const handleResendCode = () => {
    startTimer();
  };

  const startTimer = () => {
    setTimeLeft(OTP_TIME);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isEmail = (value: string) => value.includes("@");
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Verify code</h2>
        <div className="flex">
          <div className={`w-4 h-1 rotate-0 opacity-100 rounded-[2px] bg-[#E5E5E5] mr-1`} />
          <div className={`w-4 h-1 rotate-0 opacity-100 rounded-[2px] bg-[#49734F]`} />
        </div>
      </div>

      <div className="flex justify-between">
        {otp.map((value, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => handleChange(index, e.target.value, value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className={`w-11 sm:w-12 h-14 text-center text-[16px] font-medium bg-white rounded-lg focus:outline-none ${formError ? "ring-2 ring-red-500" : "border border-gray-300 focus:ring-2 focus:ring-green-500"} mb-2`}
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
        {isEmail(value) ? " Don’t forget to check the spam folder." : " Please check your SMS inbox."}
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
        onClick={handleVirifyAndContinue}
        className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium mb-4 hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
        disabled={loading}
      >
        <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
        {loading ? "Verifying..." : "Verify & Continue"}
      </button>
    </>
  );
};

export default VeriyCode;
