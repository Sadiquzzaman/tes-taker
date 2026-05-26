import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";

// without class id it will fetch all tests
// and with class id it will fetch tests of that class only

const useGetAllTests = ({ classId = "" }: { classId?: string }) => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [testList, setTestList] = useState<ITest[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);

    return axiosReq
      .get<ApiResponse<ITest[]>, AxiosResponse<ApiResponse<ITest[]>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/exams${classId ? `/class/${classId}` : ""}`,
      )
      .then(async (response) => {
        if (response.status === 200) {
          setTestList(response.data.payload);
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [classId, handleError]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetch]);

  return { loading, testList, fetch, apiComplete } as const;
};

export default useGetAllTests;
