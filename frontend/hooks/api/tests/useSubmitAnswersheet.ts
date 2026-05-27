import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";
import { useRouter } from "next/navigation";

const useSubmitAnswersheet = () => {
  const { triggerToast } = useToast();
  const router = useRouter();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async ({ examId, payload }: SubmitAnswersheetRequest) => {
    setLoading(true);

    return axiosReq
      .post<
        ApiResponse<SubmitAnswersheetResponsePayload>,
        AxiosResponse<ApiResponse<SubmitAnswersheetResponsePayload>>,
        SubmitAnswersheetPayload
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/answersheet`, payload)
      .then((response) => {
        if (response?.status === 201) {
          sessionStorage.removeItem("testId");
          router.push("/");

          triggerToast({
            title: "Success",
            description: response.data.message || "Answersheet saved successfully.",
            type: "success",
          });
        }

        return response;
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default useSubmitAnswersheet;
