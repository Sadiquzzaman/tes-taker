import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiError } from "../useApiError";
import { useDispatch } from "react-redux";
import { setNewTestCreated } from "@/lib/features/testSlice";
import { resetForm } from "@/lib/features/createTestSlice";

type T = ApiResponse<ITest>;
type R = AxiosResponse<T>;
type D = CreateTestPayload;
type E = AxiosError<ApiError>;

const useCreateTest = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const dispatch = useDispatch();

  const mutate = async (createTestPayload: CreateTestPayload) => {
    setLoading(true);

    return axiosReq
      .post<T, R, D>(`${process.env.NEXT_PUBLIC_BASE_URL}/exams`, createTestPayload)
      .then(async (response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Your test created successfully.",
            type: "success",
          });
          dispatch(
            setNewTestCreated({
              type: "new",
              test: response.data.payload,
            }),
          );
          dispatch(resetForm());
          push("/tests");
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

export default useCreateTest;
