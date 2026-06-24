import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiError } from "../useApiError";

interface UseGetStudentClassTestsParams {
  classId: string;
  enabled?: boolean;
}

const useGetStudentClassTests = ({ classId, enabled = true }: UseGetStudentClassTestsParams) => {
  const { handleError } = useApiError();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [testList, setTestList] = useState<StudentAssignedExamListItem[]>([]);

  const fetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (!classId) {
      router.push("/classes");
      return;
    }

    setLoading(true);

    return axiosReq
      .get<
        ApiResponse<StudentAssignedExamListItem[]>,
        AxiosResponse<ApiResponse<StudentAssignedExamListItem[]>>
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/class/${classId}`)
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
  }, [classId, enabled, handleError, router]);

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

export default useGetStudentClassTests;
