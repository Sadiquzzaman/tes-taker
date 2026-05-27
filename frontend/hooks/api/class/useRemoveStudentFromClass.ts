import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

const useRemoveStudentFromClass = ({ classId }: { classId: string }) => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async (
    createClassPayload: DeleteClassStudentPayload,
  ): Promise<void | ApiResponse<CreateClassResponse> | undefined> => {
    setLoading(true);

    return axiosReq
      .delete<ApiResponse<CreateClassResponse>, AxiosResponse<ApiResponse<CreateClassResponse>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/classes/${classId}/students`,
        { data: createClassPayload },
      )
      .then(async (response) => {
        if (response.status === 200) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Student(s) removed from class successfully.",
            type: "success",
          });

          return response.data;
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

export default useRemoveStudentFromClass;
