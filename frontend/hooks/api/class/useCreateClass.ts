import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiError } from "../useApiError";

type T = ApiResponse<CreateClassResponse>;
type R = AxiosResponse<T>;
type D = CreateClassPayload;
type E = AxiosError<ApiError>;

const useCreateClass = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();

  const mutate = async (createClassPayload: CreateClassPayload) => {
    setLoading(true);

    return axiosReq
      .post<T, R, D>(`${process.env.NEXT_PUBLIC_BASE_URL}/classes`, createClassPayload)
      .then(async (response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Your class created successfully.",
            type: "success",
          });
          push("/classes");
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

export default useCreateClass;

const defaultResponse = {
  statusCode: 201,
  message: "Class created successfully",
  payload: {
    id: "7f8eb3ec-a217-43fc-9aeb-e467909da287",
    is_active: 1,
    created_by: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
    created_user_name: "Sahriar Kabir",
    updated_by: null,
    updated_user_name: null,
    created_at: "2026-03-10T17:20:05.746Z",
    updated_at: null,
    class_name: "Social Science",
    description: "This is class of Social Science",
    teacher_id: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
    teacher: {
      id: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
      is_active: 1,
      created_by: null,
      created_user_name: null,
      updated_by: null,
      updated_user_name: null,
      created_at: "2026-03-05T19:16:59.839Z",
      updated_at: null,
      full_name: "Sahriar Kabir",
      email: null,
      password: "$2b$10$hUBEOnjSZAkzxJOXM2LYoeXhIiP3y5/OE5jnlT41EITtPYQsGI9WW",
      phone: "01781451385",
      is_otp_verified: true,
      is_verified: true,
      role: "TEACHER",
      refresh_token: "d150e3630a.477",
    },
    students: [],
  },
  error: false,
};
