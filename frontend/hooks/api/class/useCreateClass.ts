import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiError } from "../useApiError";
import { useDispatch } from "react-redux";
import { setOpenShareClassModal } from "@/lib/features/classSlice";

const useCreateClass = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const dispatch = useDispatch();

  const mutate = async (createClassPayload: CreateClassPayload) => {
    setLoading(true);

    return axiosReq
      .post<ApiResponse<CreateClassResponse>, AxiosResponse<ApiResponse<CreateClassResponse>>, CreateClassPayload>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/classes`,
        createClassPayload,
      )
      .then(async (response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Your class created successfully.",
            type: "success",
          });
          dispatch(setOpenShareClassModal({ ...response.data.payload, type: "new" }));
          push("/classes");
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

export default useCreateClass;
