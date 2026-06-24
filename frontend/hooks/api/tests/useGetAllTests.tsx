import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";

// without class id it will fetch all tests
// and with class id it will fetch tests of that class only

interface UseGetAllTestsParams {
  classId?: string;
  enabled?: boolean;
  role?: RoleUserType;
}

const getTestsEndpoint = ({ classId, role }: { classId: string; role: RoleUserType }) => {
  if (role === "STUDENT") {
    return `${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/assigned`;
  }

  return `${process.env.NEXT_PUBLIC_BASE_URL}/exams${classId ? `/class/${classId}` : ""}`;
};

const useGetAllTests = ({ classId = "", enabled = true, role = "TEACHER" }: UseGetAllTestsParams) => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [testList, setTestList] = useState<TestListItem[]>([]);

  const fetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);

    return axiosReq
      .get<ApiResponse<TeacherExamListItem[] | StudentAssignedExamListItem[]>, AxiosResponse<ApiResponse<TeacherExamListItem[] | StudentAssignedExamListItem[]>>>(
        getTestsEndpoint({ classId, role }),
      )
      .then(async (response) => {
        if (response.status === 200) {
          const nextTestList =
            role === "STUDENT"
              ? (response.data.payload as StudentAssignedExamListItem[])
              : (response.data.payload as TeacherExamListItem[]);

          setTestList(nextTestList);
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [classId, enabled, handleError, role]);

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
