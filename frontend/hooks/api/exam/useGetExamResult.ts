import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import useWorkspace from "@/hooks/organization/useWorkspace";

const getExamResultErrorMessage = (error: AxiosError<ApiError>): string => {
  const status = error.response?.status;
  const message = error.response?.data?.message;

  if (status === 403) {
    return "Results not published yet.";
  }

  if (status === 404) {
    return "No submission found for this exam.";
  }

  if (typeof message === "string") {
    return message;
  }

  return "Failed to load exam results.";
};

const useGetExamResult = (examId: string) => {
  const { workspace, sessionMode, contextType, organizationId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StudentExamResultPayload | null>(null);

  const requestResult = useCallback(() => {
    return axiosReq
      .get<
        ApiResponse<StudentExamResultPayload>,
        AxiosResponse<ApiResponse<StudentExamResultPayload>>
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/result`)
      .then((response) => {
        if (response.status === 200) {
          setResult(response.data.payload);
        }
      })
      .catch((err: AxiosError<ApiError>) => {
        setResult(null);
        setError(getExamResultErrorMessage(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [contextType, examId, organizationId, sessionMode, workspace]);

  const fetchResult = useCallback(async () => {
    if (!examId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    return requestResult();
  }, [examId, requestResult]);

  // Show the loading state again whenever the request changes; the effect below sends it.
  const [shownRequest, setShownRequest] = useState<{ request: typeof requestResult } | null>(null);
  if (shownRequest?.request !== requestResult) {
    setShownRequest({ request: requestResult });
    setLoading(Boolean(examId));
    if (examId) {
      setError(null);
    }
  }

  useEffect(() => {
    if (!examId) {
      return;
    }

    void requestResult();
  }, [examId, requestResult]);

  return { loading, error, result, refetch: fetchResult } as const;
};

export default useGetExamResult;
