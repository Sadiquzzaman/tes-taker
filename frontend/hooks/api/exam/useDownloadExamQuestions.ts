import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { downloadExamQuestionsPdf } from "@/utils/exam/downloadExamQuestionsPdf";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useState } from "react";
import { useApiError } from "../useApiError";

type ExamDownloadPayload = StudentExamDetails | TeacherExamDetails;

const useDownloadExamQuestions = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const download = useCallback(
    async (examId: string, testName: string) => {
      setLoading(true);

      try {
        const response = await axiosReq.get<
          ApiResponse<ExamDownloadPayload>,
          AxiosResponse<ApiResponse<ExamDownloadPayload>>
        >(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}`);

        if (response.status !== 200) {
          return;
        }

        const payload = response.data.payload;
        const subjects = payload.subjects ?? [];
        if (subjects.length === 0 || subjects.every((subject) => subject.questions.length === 0)) {
          triggerToast({
            title: "No questions available",
            description: "Questions will be available when the test starts.",
            type: "error",
          });
          return;
        }

        await downloadExamQuestionsPdf({
          testName,
          className: payload.class_name,
          durationMinutes: Number(payload.formState?.duration ?? 0),
          subjects,
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

export default useDownloadExamQuestions;
