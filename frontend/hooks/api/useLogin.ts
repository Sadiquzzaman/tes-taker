import { useToast } from "@/component/Toast/ToastContext";
import apiClient from "@/lib/axios";
import { persistAuthSession } from "@/lib/authSession";
import { restoreLastWorkspace } from "@/lib/restoreLastWorkspace";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useJoinStateManage from "../ui/useJoinStateManage";

const useLogin = () => {
  const { triggerToast } = useToast();
  const { joinInfo } = useJoinStateManage("login");
  const [loading, setLoading] = useState(false);
  const { push, refresh } = useRouter();
  const t = useTranslations();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const showLoginSuccessToast = () => {
    triggerToast({
      title: t("auth.login.successTitle"),
      description: t("auth.login.successDescription"),
      type: "success",
    });
  };

  const showLoginErrorToast = (message: string) => {
    triggerToast({
      title: t("auth.login.failedTitle"),
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
        title: t("join.classJoinFailedTitle"),
        description: typeof message === "string" ? message : t("join.classJoinFailed"),
        type: "error",
      });

      return null;
    });

    if (!response) {
      push("/classes");
      return;
    }

    triggerToast({
      title: t("join.classJoinedTitle"),
      description: t("join.classJoined"),
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

    const message = typeof responseMessage === "string" ? responseMessage : t("auth.login.failedDescription");
    showLoginErrorToast(message);
  };

  const completeLogin = async (payload: LoginResponsePayload) => {
    showLoginSuccessToast();
    const localeChanged = await persistAuthSession(payload);
    const restored = await restoreLastWorkspace(payload);
    await handlePostLoginRedirect(restored.payload, restored.href);
    if (localeChanged) {
      // The account's saved language differs from this device's: re-render the page in it.
      refresh();
    }
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
