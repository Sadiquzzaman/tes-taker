import { useToast } from "@/component/Toast/ToastContext";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export const useApiError = () => {
  const { triggerToast } = useToast();
  const { push } = useRouter();

  const handleError = useCallback((error: AxiosError<ApiError>) => {
    console.log({ error });

    if (!error.response) {
      triggerToast({
        title: "Network Error",
        description: "Unable to reach server.",
        type: "error",
      });
      return;
    }

    const { status, data } = error.response;

    if (status === 401) {
      triggerToast({
        title: "Unauthorized",
        description: typeof data.message === "string" ? data.message : "Your session has expired. Please login again.",
        type: "error",
      });

      axios.post("/api/logout").then((response) => {
        if (response.status === 200) {
          localStorage.removeItem("user");
          push("/login");
        }
      });
      return;
    }

    if (status === 403) {
      triggerToast({
        title: "Unauthenticated",
        description: typeof data.message === "string" ? data.message : "You have no permission to perform this action.",
        type: "error",
      });
      return;
    }

    if (typeof data.message === "object" && Array.isArray(data.message.message)) {
      data.message.message.forEach((msg: string) => {
        triggerToast({
          title: "Error",
          description: msg,
          type: "error",
        });
      });
      return;
    }

    const message = typeof data.message === "string" ? data.message : "An error occurred. Please try again.";

    triggerToast({
      title: "Error",
      description: message,
      type: "error",
    });
  }, []);

  return { handleError };
};
