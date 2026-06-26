import { useToast } from "@/component/Toast/ToastContext";
import apiClient from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useJoinStateManage from "../ui/useJoinStateManage";

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
      role: payload.role,
    });

    if (setTokenResponse.status !== 200) {
      throw new Error("Failed to store auth session");
    }

    localStorage.setItem("user", JSON.stringify(payload));
  };

  const handleClassJoinAfterLogin = async (classId: string) => {
    const response = await apiClient.post(`${baseUrl}/classes/${classId}/join`, {}).catch((error) => {
      if (error?.response?.data?.message === "You are already in this class") {
        return {
          data: {
            message: "You have successfully joined the class.",
            payload: {
              class_id: classId,
              status: "JOINED",
            },
          },
        };
      }
    });

    triggerToast({
      title: "Class Join Successful",
      description: response?.data?.message || "",
      type: "success",
    });

    sessionStorage.setItem("classJoinResponse", JSON.stringify(response?.data?.payload));
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

  const getRoleHomeRoute = (role: LoginResponsePayload["role"]) => {
    if (role === "STUDENT") return "/classes";
    if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
    return "/dashboard";
  };

  const consumePendingPlanRoute = (role: LoginResponsePayload["role"]) => {
    if (role !== "TEACHER" || typeof window === "undefined") return null;
    const pendingPlan = localStorage.getItem("pendingPlan");
    if (!pendingPlan) return null;
    localStorage.removeItem("pendingPlan");
    return `/billing?plan=${encodeURIComponent(pendingPlan)}`;
  };

  const handlePostLoginRedirect = async (payload: LoginResponsePayload) => {
    const isStudent = payload?.role === "STUDENT";

    const pendingPlanRoute = consumePendingPlanRoute(payload?.role);
    if (pendingPlanRoute) {
      push(pendingPlanRoute);
      return;
    }

    if (!isStudent || !joinInfo?.id) {
      push(getRoleHomeRoute(payload?.role));
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

    push(getRoleHomeRoute(payload?.role));
  };

  const handleLoginError = (error: unknown) => {
    const responseMessage = (error as { response?: { data?: { message?: string | { message?: string[] } } } }).response
      ?.data?.message;

    if (
      typeof responseMessage === "object" &&
      responseMessage &&
      Array.isArray(responseMessage.message) &&
      responseMessage.message.length
    ) {
      const messages = responseMessage.message;

      messages.forEach((message: string) => {
        showLoginErrorToast(message);
      });

      return;
    }

    const message = typeof responseMessage === "string" ? responseMessage : "Failed to send OTP. Please try again.";
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
