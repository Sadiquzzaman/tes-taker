import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";
import { useRouter } from "next/navigation";
import { useToast } from "@/component/Toast/ToastContext";

const useGetAllClassById = ({ id }: { id: string }) => {
  const { handleError } = useApiError();
  const router = useRouter();
  const { triggerToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);

  const [classData, setClassData] = useState<CreateClassResponse | null>(null);

  const fetch = useCallback(async () => {
    if (!id) {
      router.push("/classes");
      return;
    }

    setLoading(true);

    return axiosReq
      .get<ApiResponse<CreateClassResponse>, AxiosResponse<ApiResponse<CreateClassResponse>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/classes/${id}`,
      )
      .then(async (response) => {
        if (response.status === 200) {
          setClassData(response.data.payload);
        }
      })
      .catch((error: AxiosError<ApiError>) => {
        handleError(error);

        if (error.response?.status === 400) {
          router.push("/classes");
          triggerToast({
            title: "Invalid Class",
            description: "The class you are trying to access does not exist.",
            type: "error",
          });
        }
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  }, [handleError, id, router, triggerToast]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetch]);

  return { loading, classData, fetch, apiComplete } as const;
};

export default useGetAllClassById;
