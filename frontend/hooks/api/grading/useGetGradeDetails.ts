"use client";

import axiosReq from "@/lib/axios";
import { resetGradeDetails, setGradeDetailsData } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { AxiosError, AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApiError } from "../useApiError";

const GRADING_DETAILS_LIMIT = 6;

const useGetGradeDetails = (examId: string) => {
  const { currentPage, searchStudentInput } = useAppSelector((state) => state.gradeDetails);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [readyExamId, setReadyExamId] = useState("");
  const normalizedSearchInput = useMemo(() => searchStudentInput.trim(), [searchStudentInput]);

  const fetch = useCallback(async () => {
    if (!examId) {
      router.push("/grading");
      return;
    }

    setLoading(true);

    const params: GradingSummaryQuery = {
      page: currentPage,
      limit: GRADING_DETAILS_LIMIT,
    };

    if (normalizedSearchInput) {
      params.search = normalizedSearchInput;
    }

    return axiosReq
      .get<GradingSummaryResponse, AxiosResponse<GradingSummaryResponse>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}`,
        {
          params,
        },
      )
      .then((response) => {
        if (response.status === 200) {
          dispatch(
            setGradeDetailsData({
              exam: response.data.payload.exam,
              stats: response.data.payload.stats,
              submissions: response.data.payload.submissions,
              meta: response.data.meta,
            }),
          );
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [currentPage, dispatch, examId, handleError, normalizedSearchInput, router]);

  useEffect(() => {
    setApiComplete(false);
    setReadyExamId("");
    dispatch(resetGradeDetails());

    if (!examId) {
      router.push("/grading");
    } else {
      setReadyExamId(examId);
    }

    return () => {
      setReadyExamId("");
      dispatch(resetGradeDetails());
    };
  }, [dispatch, examId, router]);

  useEffect(() => {
    if (readyExamId !== examId) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [examId, fetch, readyExamId]);

  return {
    loading,
    apiComplete,
    fetch,
  } as const;
};

export default useGetGradeDetails;
