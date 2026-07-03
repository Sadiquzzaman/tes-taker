import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

const usePublishGradeResults = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async ({ examId }: PublishGradeResultsRequest) => {
    setLoading(true);

    return axiosReq
      .post<ApiResponse<PublishResultResponse>, AxiosResponse<ApiResponse<PublishResultResponse>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}/publish`,
      )
      .then((response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Results published successfully.",
            type: "success",
          });
        }

        return response;
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
        return undefined;
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default usePublishGradeResults;
