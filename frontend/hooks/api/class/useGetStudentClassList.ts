import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";

const useGetStudentClassList = () => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [classList, setClassList] = useState<StudentClass[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);

    return axiosReq
      .get<ApiResponse<StudentClass[]>, AxiosResponse<ApiResponse<StudentClass[]>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/student/classes`,
      )
      .then(async (response) => {
        if (response.status === 200) {
          setClassList(response.data.payload);
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [handleError]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetch]);

  return { loading, classList, fetch, apiComplete } as const;
};

export default useGetStudentClassList;
