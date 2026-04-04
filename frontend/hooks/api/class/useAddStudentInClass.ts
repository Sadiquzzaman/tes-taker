import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

type T = ApiResponse<CreateClassResponse>;
type R = AxiosResponse<T>;
type D = { students: string[] };
type E = AxiosError<ApiError>;

const useAddStudentInClass = ({ classId }: { classId: string }) => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async (apiPayload: D): Promise<T | undefined | void> => {
    setLoading(true);

    return axiosReq
      .post<T, R, D>(`${process.env.NEXT_PUBLIC_BASE_URL}/classes/${classId}/students`, apiPayload)
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
      .catch((error: E) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default useAddStudentInClass;
