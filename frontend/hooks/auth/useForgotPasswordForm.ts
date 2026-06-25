import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";
import { validateForgotIdentifier, validateResetPassword } from "@/utils/auth/validation";

const OTP_LENGTH = 6;
const OTP_TIME = 60;

type ForgotPasswordView = "request" | "otp" | "reset";

interface ForgotPasswordOtpResponse {
  payload?: {
    maskedPhone?: string | null;
    maskedEmail?: string | null;
  };
}

export const useForgotPasswordForm = () => {
  const router = useRouter();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const [view, setView] = useState<ForgotPasswordView>("request");
  const [identifier, setIdentifier] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [timeLeft, setTimeLeft] = useState(OTP_TIME);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{ password: string; confirm_password: string }>({
    password: "",
    confirm_password: "",
  });

  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const buildMaskedTarget = (response?: ForgotPasswordOtpResponse) => {
    const maskedPhone = response?.payload?.maskedPhone;
    const maskedEmail = response?.payload?.maskedEmail;
    return [maskedPhone, maskedEmail].filter(Boolean).join(" and ");
  };

  const sendResetOtp = async (isResend = false) => {
    const error = validateForgotIdentifier(identifier);
    if (error) {
      setIdentifierError(error);
      return;
    }
    setIdentifierError("");

    if (isResend) {
      setVerifyLoading(true);
    } else {
      setRequestLoading(true);
    }

    try {
      const response = await axiosReq.post<ForgotPasswordOtpResponse>(`${baseUrl}/auth/forgot-password`, {
        identifier: identifier.trim(),
      });

      setMaskedTarget(buildMaskedTarget(response.data));
      setOtp(Array(OTP_LENGTH).fill(""));
      setOtpError("");
      setView("otp");
      startTimer();

      triggerToast({
        title: "Code sent",
        description: "We've sent a reset code to your phone and email.",
        type: "success",
      });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setRequestLoading(false);
      setVerifyLoading(false);
    }
  };

  const handleRequestOtp = () => {
    void sendResetOtp(false);
  };

  const handleResendCode = () => {
    if (timeLeft !== 0) return;
    void sendResetOtp(true);
  };

  const handleOtpChange = (index: number, val: string, prevValue: string) => {
    if (!/^\d*$/.test(val)) return;
    setOtpError("");

    let newValue = "";
    if (val.length === 1) newValue = val;
    else if (val.length === 2 && prevValue === val[0]) newValue = val[1];
    else if (val.length === 2 && prevValue === val[1]) newValue = val[0];

    const newOtp = [...otp];
    newOtp[index] = newValue;
    setOtp(newOtp);

    if (newValue && index < OTP_LENGTH - 1) {
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

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const handleVerifyOtp = async () => {
    if (otp.some((digit) => digit === "")) {
      setOtpError("Please enter the complete OTP code");
      return;
    }

    setVerifyLoading(true);
    try {
      await axiosReq.post(`${baseUrl}/auth/reset-password/verify-otp`, {
        identifier: identifier.trim(),
        otp: otp.join(""),
      });

      setView("reset");
      triggerToast({
        title: "Code verified",
        description: "Set your new password to continue.",
        type: "success",
      });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const errors = validateResetPassword(password, confirmPassword);
    setPasswordErrors({
      password: errors.password || "",
      confirm_password: errors.confirm_password || "",
    });

    if (errors.password || errors.confirm_password) {
      return;
    }

    setResetLoading(true);
    try {
      await axiosReq.post(`${baseUrl}/auth/reset-password`, {
        identifier: identifier.trim(),
        otp: otp.join(""),
        password,
        confirm_password: confirmPassword,
      });

      triggerToast({
        title: "Password updated",
        description: "Your password has been reset. Please login.",
        type: "success",
      });

      router.push("/login");
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setResetLoading(false);
    }
  };

  const handleIdentifierChange = (value: string) => {
    setIdentifierError("");
    setIdentifier(value);
  };

  const handlePasswordChange = (field: "password" | "confirm_password", value: string) => {
    setPasswordErrors((prev) => ({ ...prev, [field]: "" }));
    if (field === "password") {
      setPassword(value);
    } else {
      setConfirmPassword(value);
    }
  };

  return {
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
  };
};

export default useForgotPasswordForm;
