"use client";

import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import { normalizeSubmissionGradingDetail } from "@/utils/grading/normalizeSubmissionGradingDetail";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useState } from "react";

const useGetSubmissionGradingDetail = (examId?: string | null, submissionId?: string | null) => {
  const { handleError } = useApiError();
  const [data, setData] = useState<GradingModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);

  const fetch = useCallback(async () => {
    if (!examId || !submissionId) {
      setData(null);
      setApiComplete(true);
      return null;
    }

    setLoading(true);
    setApiComplete(false);
    setData(null);

    return axiosReq
      .get<ApiResponse<SubmissionGradingDetailPayload>, AxiosResponse<ApiResponse<SubmissionGradingDetailPayload>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}/submissions/${submissionId}`,
      )
      .then((response) => {
        if (response.status === 200) {
          const normalizedData = normalizeSubmissionGradingDetail(response.data.payload);
          setData(normalizedData);
          return normalizedData;
        }

        return null;
      })
      .catch((error: AxiosError<ApiError>) => {
        setData(null);
        handleError(error);
        return null;
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [examId, handleError, submissionId]);

  return { data, loading, apiComplete, fetch } as const;
};

export default useGetSubmissionGradingDetail;
