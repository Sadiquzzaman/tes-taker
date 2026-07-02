"use client";

import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import buildSubmissionGrades from "@/utils/grading/buildSubmissionGrades";
import { normalizeSubmissionGradingDetail } from "@/utils/grading/normalizeSubmissionGradingDetail";
import { cacheSubmissionGradingDetail, selectSubmissionGradingEntry } from "@/lib/features/gradingSubmissionSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";

const useGetSubmissionGradingDetail = (examId?: string | null, submissionId?: string | null) => {
  const dispatch = useAppDispatch();
  const { handleError } = useApiError();
  const cachedEntry = useAppSelector((state) => selectSubmissionGradingEntry(state, examId, submissionId));
  const [data, setData] = useState<GradingModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);

  useEffect(() => {
    if (cachedEntry?.apiResponse) {
      setData(cachedEntry.apiResponse);
      setApiComplete(true);
      return;
    }

    setData(null);
    setApiComplete(false);
  }, [cachedEntry, examId, submissionId]);

  const fetch = useCallback(async () => {
    if (!examId || !submissionId) {
      setData(null);
      setApiComplete(true);
      return null;
    }

    if (cachedEntry?.apiResponse) {
      setData(cachedEntry.apiResponse);
      setApiComplete(true);
      return cachedEntry.apiResponse;
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
          dispatch(
            cacheSubmissionGradingDetail({
              examId,
              submissionId,
              apiResponse: normalizedData,
              graded: buildSubmissionGrades(normalizedData),
            }),
          );
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
  }, [cachedEntry, dispatch, examId, handleError, submissionId]);

  return { data, loading, apiComplete, fetch } as const;
};

export default useGetSubmissionGradingDetail;
