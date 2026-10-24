import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";

const OTP_TIME = 60;
const length = 6;

export const useVerifyCode = (
  value: string,
  options?: { successTitle?: string; successDescription?: string },
) => {
  const router = useRouter();
  const { triggerToast } = useToast();
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const [formError, setFormError] = useState("");
  const [otp, setOtp] = useState(Array(length).fill(""));
  const [timeLeft, setTimeLeft] = useState(OTP_TIME);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const startCountdown = () => {
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

  // timeLeft already starts at OTP_TIME, so the first countdown only needs the interval.
  useEffect(() => {
    startCountdown();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTimer = () => {
    setTimeLeft(OTP_TIME);
    startCountdown();
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
      setFormError(tv("otpIncomplete"));
      return;
    }

    let classInvitationToken: string | undefined;
    try {
      const joinSessionInfo = sessionStorage.getItem("joinSessionInfo");
      if (joinSessionInfo) {
        const parsedInfo = JSON.parse(joinSessionInfo) as { joinType?: string; id?: string };
        if (parsedInfo.joinType === "class" && parsedInfo.id) {
          classInvitationToken = parsedInfo.id;
        }
      }
    } catch (error) {
      console.warn("[useVerifyCode] Failed to read joinSessionInfo", error);
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/auth/register/verify-otp`,
        {
          phone: value,
          otp: otp.join(""),
          ...(classInvitationToken ? { classInvitationToken } : {}),
        },
        {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      setLoading(false);
      const orgNumber = response.data?.payload?.data?.organization?.organization_number;
      const defaultOrgDescription = orgNumber
        ? t("signup.organizationNumber", { number: orgNumber })
        : options?.successDescription;

      triggerToast({
        title: options?.successTitle || t("otp.verifiedTitle"),
        description: defaultOrgDescription || t("otp.verifiedDescription"),
        type: "success",
      });

      router.push("/login");
    } catch (caught) {
      const err = caught as AxiosError<{ message?: string }>;
      setLoading(false);
      const message = err.response?.data?.message || t("otp.failedDescription");
      triggerToast({
        title: t("otp.failedTitle"),
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
