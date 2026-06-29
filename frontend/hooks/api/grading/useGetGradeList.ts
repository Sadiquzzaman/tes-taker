"use client";

import axiosReq from "@/lib/axios";
import { setSearchInput } from "@/lib/features/gradingSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApiError } from "../useApiError";

const GRADING_LIST_LIMIT = 9;

const useGetGradeList = () => {
  const { activeTab, page, searchInput } = useAppSelector((state) => state.grade);
  const dispatch = useAppDispatch();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [gradeList, setGradeList] = useState<GradingListItem[]>([]);
  const [meta, setMeta] = useState<GradingPaginationMeta | null>(null);
  const activeTabValue = activeTab.value;
  const normalizedSearchInput = useMemo(() => searchInput.trim(), [searchInput]);

  const fetch = useCallback(async () => {
    setLoading(true);

    const params: GradingListQuery = {
      page,
      limit: GRADING_LIST_LIMIT,
    };

    if (activeTabValue !== "ALL") {
      params.status = activeTabValue as GradingStatus;
    }

    if (normalizedSearchInput) {
      params.search = normalizedSearchInput;
    }

    return axiosReq
      .get<GradingListResponse, AxiosResponse<GradingListResponse>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/list`,
        {
          params,
        },
      )
      .then((response) => {
        if (response.status === 200) {
          setGradeList(response.data.payload);
          setMeta(response.data.meta);
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [activeTabValue, handleError, normalizedSearchInput, page]);

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [dispatch]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetch]);

  return {
    loading,
    apiComplete,
    gradeList,
    meta,
    fetch,
  } as const;
};

export default useGetGradeList;
