import { useRef, useState, useEffect } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import axios from "axios";
import { useRouter } from "next/navigation";

const OTP_TIME = 60;
const length = 6;

export const useVerifyCode = (value: string) => {
  const router = useRouter();
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

  const startTimer = () => {
    setTimeLeft(OTP_TIME);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (index: number, val: string, prevValue: string) => {
    if (!/^\d*$/.test(val)) return;

    setFormError("");

    let newValue = "";
    if (val.length === 1) newValue = val;
    else if (val.length === 2 && prevValue === val[0]) newValue = val[1];
    else if (val.length === 2 && prevValue === val[1]) newValue = val[0];

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

  const handleVerifyAndContinue = async () => {
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

      router.push("/login");
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

  const handleResendCode = () => {
    startTimer();
  };

  return {
    otp,
    timeLeft,
    loading,
    formError,
    inputsRef,
    handleChange,
    handleKeyDown,
    handleVerifyAndContinue,
    handleResendCode,
  };
};

export default useVerifyCode;
