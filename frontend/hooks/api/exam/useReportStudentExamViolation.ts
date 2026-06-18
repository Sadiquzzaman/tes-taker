import axiosReq from "@/lib/axios";
import { AxiosError } from "axios";
import { useApiError } from "../useApiError";

const useReportStudentExamViolation = () => {
  const { handleError } = useApiError();

  const mutate = async ({
    examId,
    violationType,
  }: {
    examId: string;
    violationType: "TAB_SWITCH" | "BROWSER_SWITCH";
  }) => {
    return axiosReq
      .post(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${examId}/report-violation`, {
        violation_type: violationType,
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
        return undefined;
      });
  };

  return mutate;
};

export default useReportStudentExamViolation;
