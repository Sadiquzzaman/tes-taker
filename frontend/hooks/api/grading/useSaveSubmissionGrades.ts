import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

const useSaveSubmissionGrades = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async ({ examId, submissionId, payload }: SaveSubmissionGradesRequest) => {
    setLoading(true);

    return axiosReq
      .patch<
        ApiResponse<SaveSubmissionGradesResponse>,
        AxiosResponse<ApiResponse<SaveSubmissionGradesResponse>>,
        SaveSubmissionGradesPayload
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}/submissions/${submissionId}`, payload)
      .then((response) => {
        if (response.status === 200) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Submission grades saved successfully.",
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

export default useSaveSubmissionGrades;
