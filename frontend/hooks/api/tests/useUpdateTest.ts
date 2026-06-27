import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiError } from "../useApiError";
import { useDispatch } from "react-redux";
import { resetForm } from "@/lib/features/createTestSlice";

const useUpdateTest = (examId: string | null) => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const dispatch = useDispatch();

  const mutate = async (createTestPayload: CreateTestPayload) => {
    if (!examId) {
      return;
    }

    setLoading(true);

    return axiosReq
      .put<ApiResponse<ITest>, AxiosResponse<ApiResponse<ITest>>, CreateTestPayload>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}`,
        createTestPayload,
      )
      .then(async (response) => {
        if (response.status === 200 || response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Your test was updated successfully.",
            type: "success",
          });
          dispatch(resetForm());
          push(`/tests/${examId}`);
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default useUpdateTest;
