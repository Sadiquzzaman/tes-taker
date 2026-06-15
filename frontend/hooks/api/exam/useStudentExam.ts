import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";
import { useRouter } from "next/navigation";

const useStudentExam = ({ enabled = true }: { enabled?: boolean }) => {
  const router = useRouter();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [examData, setExamData] = useState<ITest | null>(null);

  const fetch = useCallback(
    async (examId?: string | null) => {
      setLoading(true);

      return axiosReq
        .get<ApiResponse<ITest>, AxiosResponse<ApiResponse<ITest>>>(
          `${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}`,
        )
        .then((response) => {
          if (response.status === 200) {
            setExamData(response.data.payload);
          }
        })
        .catch((error: AxiosError<ApiError>) => {
          setExamData(null);
          handleError(error);
        })
        .finally(() => {
          setLoading(false);
          setApiComplete(true);
        });
    },
    [handleError],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const testId = sessionStorage.getItem("testId");

    if (!testId) {
      router.push("/");
    } else {
      fetch(testId);
    }
  }, [enabled, fetch, router]);

  return { loading, apiComplete, examData, fetch } as const;
};

export default useStudentExam;
