import { useToast } from "@/component/Toast/ToastContext";
import { useTranslations } from "next-intl";
import { downloadExamResultsPdf } from "@/utils/exam/downloadExamResultsPdf";
import { fetchAllGradingSubmissions } from "@/utils/grading/fetchAllGradingSubmissions";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useApiError } from "../useApiError";

const useDownloadExamResults = () => {
  const { triggerToast } = useToast();
  const t = useTranslations("grading.details");
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const download = useCallback(
    async (examId: string, testName: string) => {
      setLoading(true);

      try {
        const { exam, submissions } = await fetchAllGradingSubmissions(examId);

        if (submissions.length === 0) {
          triggerToast({
            title: t("noResultsTitle"),
            description: t("noResults"),
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
    [handleError, t, triggerToast],
  );

  return { download, loading } as const;
};

export default useDownloadExamResults;
