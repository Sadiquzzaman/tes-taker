import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useApiError } from "../useApiError";
import { useRouter } from "next/navigation";
import { useToast } from "@/component/Toast/ToastContext";

type T = ApiResponse<CreateClassResponse>;
type R = AxiosResponse<T>;
type E = AxiosError<ApiError>;

const useGetAllClassById = ({ id }: { id: string }) => {
  const { handleError } = useApiError();
  const router = useRouter();
  const { triggerToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [classData, setClassData] = useState<CreateClassResponse | null>(null);

  const fetch = async () => {
    if (!id) {
      router.push("/classes");
      return;
    }

    setLoading(true);

    return axiosReq
      .get<T, R>(`${process.env.NEXT_PUBLIC_BASE_URL}/classes/${id}`)
      .then(async (response) => {
        if (response.status === 200) {
          setClassData(response.data.payload);
        }
      })
      .catch((error: E) => {
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
      });
  };

  useEffect(() => {
    fetch();
  }, []);

  return { loading, classData, fetch } as const;
};

export default useGetAllClassById;

const defaultResponse = {
  statusCode: 200,
  message: "Class retrieved successfully",
  payload: {
    id: "76d41f07-abd0-4d43-b773-01e146a1aff7",
    is_active: 1,
    created_by: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
    created_user_name: "Sahriar Kabir",
    updated_by: null,
    updated_user_name: null,
    created_at: "2026-03-10T18:10:18.323Z",
    updated_at: null,
    class_name: "Class 5C",
    description: "",
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
      refresh_token: "1f3bf65a12.5abc",
    },
    students: [],
  },
  error: false,
};
