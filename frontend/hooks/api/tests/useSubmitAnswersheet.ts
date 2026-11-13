import { useToast } from "@/component/Toast/ToastContext";
import { exitFullscreenIfActive } from "@/hooks/tests/proctoring/proctoringMonitorUtils";
import axiosReq from "@/lib/axios";
import { clearExamAnswersFromStorage } from "@/utils/tests/examAnswerStorage";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";
import { useRouter } from "next/navigation";

/** The submit could not reach the server (no connection). */
export const OFFLINE = "offline" as const;

const useSubmitAnswersheet = () => {
  const { triggerToast } = useToast();
  const router = useRouter();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async ({ examId, payload, onSuccess }: SubmitAnswersheetRequest) => {
    setLoading(true);

    return axiosReq
      .post<
        ApiResponse<SubmitAnswersheetResponsePayload>,
        AxiosResponse<ApiResponse<SubmitAnswersheetResponsePayload>>,
        SubmitAnswersheetPayload
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/answersheet`, payload)
      .then(async (response) => {
        if (response?.status === 201) {
          await exitFullscreenIfActive();
          clearExamAnswersFromStorage(examId, payload.studentId);
          sessionStorage.removeItem("testId");

          const reason = payload.reason ?? "manual";

          if (onSuccess) {
            onSuccess(reason);
            return response;
          }

          router.push("/");
          triggerToast({
            title: "Success",
            description: response.data.message || "Exam submitted successfully.",
            type: "success",
          });
        }

        return response;
      })
      .catch((error: AxiosError<ApiError>) => {
        // No answer at all: the connection is down (PRO-09); the page tries again.
        if (!error.response) return OFFLINE;
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default useSubmitAnswersheet;
