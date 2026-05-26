import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

const useAddStudentInClass = ({ classId }: { classId: string }) => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async (
    apiPayload: AddStudentInClassPayload,
  ): Promise<ApiResponse<CreateClassResponse> | undefined | void> => {
    setLoading(true);

    return axiosReq
      .post<
        ApiResponse<CreateClassResponse>,
        AxiosResponse<ApiResponse<CreateClassResponse>>,
        AddStudentInClassPayload
      >(`${process.env.NEXT_PUBLIC_BASE_URL}/classes/${classId}/students`, apiPayload)
      .then(async (response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Students added successfully.",
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

export default useAddStudentInClass;
