import { useToast } from "@/component/Toast/ToastContext";
import apiClient from "@/lib/axios";
import { persistAuthSession } from "@/lib/authSession";
import { restoreLastWorkspace } from "@/lib/restoreLastWorkspace";
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

  const handleClassJoinAfterLogin = async (classId: string) => {
    const response = await apiClient.post(`${baseUrl}/classes/${classId}/join`, {}).catch((error) => {
      const message = error?.response?.data?.message;

      if (message === "You are already in this class") {
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

      triggerToast({
        title: "Class Join Failed",
        description: typeof message === "string" ? message : "Unable to join this class.",
        type: "error",
      });

      return null;
    });

    if (!response) {
      push("/classes");
      return;
    }

    triggerToast({
      title: "Class Join Successful",
      description: response.data?.message || "You have successfully joined the class.",
      type: "success",
    });

    sessionStorage.setItem("classJoinResponse", JSON.stringify(response.data?.payload));
    push("/join/class");
  };

  const handleTestJoinAfterLogin = async (testId: string) => {
    const eligibilityResponse = await apiClient.get(`${baseUrl}/student/exams/${testId}/eligibility`);

    sessionStorage.setItem("testJoinResponse", JSON.stringify(eligibilityResponse.data?.payload));
    push("/join/test");
  };

  const handlePostLoginRedirect = async (payload: LoginResponsePayload, href: string) => {
    const isStudent = payload?.role === "STUDENT";

    if (isStudent && joinInfo?.id) {
      if (joinInfo.joinType === "class") {
        await handleClassJoinAfterLogin(joinInfo.id);
        return;
      }
      if (joinInfo.joinType === "test") {
        await handleTestJoinAfterLogin(joinInfo.id);
        return;
      }
    }

    push(href);
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
      responseMessage.message.forEach((message: string) => {
        showLoginErrorToast(message);
      });
      return;
    }

    const message = typeof responseMessage === "string" ? responseMessage : "Login failed. Please try again.";
    showLoginErrorToast(message);
  };

  const completeLogin = async (payload: LoginResponsePayload) => {
    showLoginSuccessToast(payload?.message);
    await persistAuthSession(payload);
    const restored = await restoreLastWorkspace(payload);
    await handlePostLoginRedirect(restored.payload, restored.href);
  };

  const mutate = async (loginInfo: LoginPayload) => {
    setLoading(true);

    try {
      const response = await apiClient.post(`${baseUrl}/auth/login`, loginInfo);

      if (response.status !== 200) {
        throw new Error("Unexpected response status");
      }

      const payload = response.data?.payload as LoginResponsePayload;
      await completeLogin(payload);
    } catch (error) {
      handleLoginError(error);
    } finally {
      setLoading(false);
    }
  };

  const mutateOrganization = async (loginInfo: OrganizationLoginPayload) => {
    setLoading(true);

    try {
      const response = await apiClient.post(`${baseUrl}/auth/login/organization`, loginInfo);

      if (response.status !== 200) {
        throw new Error("Unexpected response status");
      }

      const payload = response.data?.payload as LoginResponsePayload;
      await completeLogin(payload);
    } catch (error) {
      handleLoginError(error);
    } finally {
      setLoading(false);
    }
  };

  return [mutate, mutateOrganization, { loading }] as const;
};

export default useLogin;
