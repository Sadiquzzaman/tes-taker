import { useToast } from "@/component/Toast/ToastContext";
import apiClient from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useJoinStateManage from "../ui/useJoinStateManage";

type LoginResponsePayload = User & {
  message?: string;
};

const useLogin = () => {
  const { triggerToast } = useToast();
  const { joinInfo } = useJoinStateManage("login");
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const showLoginSuccessToast = (message?: string) => {
    triggerToast({
      title: "Login Successful",
      description: message || "User login successful.",
      type: "success",
    });
  };

  const showLoginErrorToast = (message: string) => {
    triggerToast({
      title: "Login Failed",
      description: message,
      type: "error",
    });
  };

  const persistAuthSession = async (payload: LoginResponsePayload) => {
    const setTokenResponse = await apiClient.post("/api/set-token", {
      token: payload.access_token,
      refreshToken: payload.refresh_token,
    });

    if (setTokenResponse.status !== 200) {
      throw new Error("Failed to store auth session");
    }

    localStorage.setItem("user", JSON.stringify(payload));
  };

  const handleClassJoinAfterLogin = async (classId: string) => {
    const response = await apiClient.post(`${baseUrl}/classes/${classId}/join`, {});

    triggerToast({
      title: "Class Join Successful",
      description: response.data?.message || "",
      type: "success",
    });

    sessionStorage.setItem("classJoinResponse", JSON.stringify(response.data?.payload));
    push("/join/class");
  };

  const handleTestJoinAfterLogin = async (testId: string) => {
    const eligibilityResponse = await apiClient.get(`${baseUrl}/student/exams/${testId}/eligibility`);

    if (eligibilityResponse.data?.payload?.eligible) {
      apiClient
        .post(`${baseUrl}/classes/${testId}/join`, {})
        .then(() => {})
        .catch(() => {});
    }

    sessionStorage.setItem("testJoinResponse", JSON.stringify(eligibilityResponse.data?.payload));
    push("/join/test");
  };

  const handlePostLoginRedirect = async (payload: LoginResponsePayload) => {
    const isStudent = payload?.role === "STUDENT";

    if (!isStudent || !joinInfo?.id) {
      push("/");
      return;
    }

    if (joinInfo.joinType === "class") {
      await handleClassJoinAfterLogin(joinInfo.id);
      return;
    }

    if (joinInfo.joinType === "test") {
      await handleTestJoinAfterLogin(joinInfo.id);
      return;
    }

    push("/");
  };

  const handleLoginError = (error: any) => {
    if (error?.response?.data?.message?.message?.length) {
      const messages = error.response.data.message.message;

      messages.forEach((message: string) => {
        showLoginErrorToast(message);
      });

      return;
    }

    const message = error?.response?.data?.message || "Failed to send OTP. Please try again.";
    showLoginErrorToast(message);
  };

  const mutate = async (loginInfo: LoginPayload) => {
    setLoading(true);

    try {
      const response = await apiClient.post(`${baseUrl}/auth/login`, loginInfo);

      if (response.status !== 200) {
        throw new Error("Unexpected response status");
      }

      const payload = response.data?.payload as LoginResponsePayload;

      showLoginSuccessToast(payload?.message);
      await persistAuthSession(payload);
      await handlePostLoginRedirect(payload);
    } catch (error) {
      handleLoginError(error);
    } finally {
      setLoading(false);
    }
  };

  return [mutate, { loading }] as const;
};

export default useLogin;
