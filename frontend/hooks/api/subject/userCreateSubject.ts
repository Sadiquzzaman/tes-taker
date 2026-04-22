import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { addSubject } from "@/lib/features/subjectSlice";
import { useAppDispatch } from "@/lib/hooks";
import { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { useApiError } from "../useApiError";

type CreateSubjectPayload = {
  name: string;
  code: string;
};

type CreateSubjectResponse = {
  id: string;
  name: string;
  code: string | null;
};

type CreatedSubjectOption = {
  id: string;
  label: string;
  value: string;
};

type T = ApiResponse<CreateSubjectResponse>;
type R = AxiosResponse<T>;
type D = CreateSubjectPayload;
type E = AxiosError<ApiError>;

const useCreateSubject = () => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);

  const mutate = async (createSubjectPayload: CreateSubjectPayload): Promise<CreatedSubjectOption | null> => {
    const name = createSubjectPayload.name.trim();
    const code = createSubjectPayload.code.trim().toUpperCase();

    if (!name) {
      triggerToast({
        title: "Validation Error",
        description: "Subject name is required.",
        type: "error",
      });
      return null;
    }

    if (!code) {
      triggerToast({
        title: "Validation Error",
        description: "Subject code is required.",
        type: "error",
      });
      return null;
    }

    setLoading(true);

    return axiosReq
      .post<T, R, D>(`${process.env.NEXT_PUBLIC_BASE_URL}/subjects`, { name, code })
      .then((response) => {
        if (response.status === 201) {
          triggerToast({
            title: "Success",
            description: response.data.message || "Subject created successfully.",
            type: "success",
          });

          const nextSubject = {
            label: response?.data?.payload?.name || "",
            value: response?.data?.payload?.code || response?.data?.payload?.name || "",
            id: response?.data?.payload?.id || "",
          };

          dispatch(
            addSubject({
              id: nextSubject.id,
              name: nextSubject.label,
              value: nextSubject.value,
            }),
          );

          return nextSubject;
        }

        return null;
      })
      .catch((error: E) => {
        handleError(error);
        return null;
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default useCreateSubject;
