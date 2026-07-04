import { useToast } from "@/component/Toast/ToastContext";
import { downloadExamResultsPdf } from "@/utils/exam/downloadExamResultsPdf";
import { fetchAllGradingSubmissions } from "@/utils/grading/fetchAllGradingSubmissions";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useApiError } from "../useApiError";

const useDownloadExamResults = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const download = useCallback(
    async (examId: string, testName: string) => {
      setLoading(true);

      try {
        const { exam, submissions } = await fetchAllGradingSubmissions(examId);

        if (submissions.length === 0) {
          triggerToast({
            title: "No results available",
            description: "There are no student submissions to download yet.",
            type: "error",
          });
          return;
        }

        await downloadExamResultsPdf({
          testName: testName || exam.test_name || "exam-results",
          className: exam.class_name,
          subject: exam.subject,
          submissions,
        });
      } catch (error) {
        handleError(error as AxiosError<ApiError>);
      } finally {
        setLoading(false);
      }
    },
    [handleError, triggerToast],
  );

  return { download, loading } as const;
};

export default useDownloadExamResults;
