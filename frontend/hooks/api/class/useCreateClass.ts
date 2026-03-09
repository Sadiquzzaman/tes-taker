import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiError } from "../useApiError";

const useCreateClass = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();

  const mutate = async (createClassPayload: CreateClassPayload) => {
    setLoading(true);

    return axiosReq
      .post(`${process.env.NEXT_PUBLIC_BASE_URL}/classes`, createClassPayload)
      .then(async (response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Class Created Successfully",
            description: response.data.payload?.message || "Class created successfully.",
            type: "success",
          });
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
