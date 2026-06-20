import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

const useStartStudentExam = () => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async ({ examId, payload }: { examId: string; payload: StartStudentExamPayload }) => {
    setLoading(true);

    return axiosReq
      .post<
        ApiResponse<StartStudentExamResponsePayload>,
        AxiosResponse<ApiResponse<StartStudentExamResponsePayload>>,
        StartStudentExamPayload
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/start`, payload)
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

export default useStartStudentExam;
