import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";

// without class id it will fetch all tests
// and with class id it will fetch tests of that class only

const useGetAllTests = ({ classId = "", enabled = true }: { classId?: string; enabled?: boolean }) => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [testList, setTestList] = useState<ITest[]>([]);

  const fetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

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
  }, [classId, enabled, handleError]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [enabled, fetch]);

  return {
    loading: enabled ? loading : false,
    testList: enabled ? testList : [],
    fetch,
    apiComplete: enabled ? apiComplete : true,
  } as const;
};

export default useGetAllTests;
