import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";
import { useRouter } from "next/navigation";

const useStudentExam = ({ enabled = true, examId }: { enabled?: boolean; examId?: string | null }) => {
  const router = useRouter();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [examData, setExamData] = useState<StudentExamDetails | null>(null);

  const fetch = useCallback(
    async (examId?: string | null) => {
      if (!examId) {
        setApiComplete(true);
        setExamData(null);
        return;
      }

      setLoading(true);

      return axiosReq
        .get<ApiResponse<StudentExamDetails>, AxiosResponse<ApiResponse<StudentExamDetails>>>(
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

    if (!examId) {
      router.push("/");
    } else {
      const timeoutId = window.setTimeout(() => {
        void fetch(examId);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [enabled, examId, fetch, router]);

  return { loading, apiComplete, examData, fetch } as const;
};

export default useStudentExam;
