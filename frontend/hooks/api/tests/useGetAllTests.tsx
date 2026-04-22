import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useApiError } from "../useApiError";

type T = ApiResponse<ITest[]>;
type R = AxiosResponse<T>;
type E = AxiosError<ApiError>;

// without class id it will fetch all tests
// and with class id it will fetch tests of that class only

const useGetAllTests = ({ classId = "" }: { classId?: string }) => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [testList, setTestList] = useState<ITest[]>([]);

  const fetch = async () => {
    setLoading(true);

    return axiosReq
      .get<T, R>(`${process.env.NEXT_PUBLIC_BASE_URL}/exams${classId ? `/class/${classId}` : ""}`)
      .then(async (response) => {
        if (response.status === 200) {
          setTestList(response.data.payload);
        }
      })
      .catch((error: E) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  };

  useEffect(() => {
    fetch();
  }, []);

  return { loading, testList, fetch, apiComplete } as const;
};

export default useGetAllTests;
