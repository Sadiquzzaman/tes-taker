import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiError } from "../useApiError";
import { useDispatch } from "react-redux";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import useWorkspace from "@/hooks/organization/useWorkspace";

const useCreateClass = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const dispatch = useDispatch();
  const { isIndividual } = useWorkspace();

  const mutate = async (createClassPayload: CreateClassPayload) => {
    setLoading(true);
    const body = {
      class_name: createClassPayload.class_name,
      description: createClassPayload.description,
      students: createClassPayload.student_ids,
    };

    return axiosReq
      .post<ApiResponse<CreateClassResponse>, AxiosResponse<ApiResponse<CreateClassResponse>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/classes`,
        body,
      )
      .then(async (response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Your class created successfully.",
            type: "success",
          });
          dispatch(setOpenShareClassModal({ ...response.data.payload, type: "new" }));
          push(isIndividual ? "/classes" : "/organization/classes");
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
