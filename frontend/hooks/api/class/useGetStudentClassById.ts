import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiError } from "../useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";

const useGetStudentClassById = ({ id, enabled = true }: { id: string; enabled?: boolean }) => {
  const { handleError } = useApiError();
  const { workspace, sessionMode, contextType, organizationId } = useWorkspace();
  const router = useRouter();
  const { triggerToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [classData, setClassData] = useState<ClassDetailsData | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (!id) {
      router.push("/classes");
      return;
    }

    setLoading(true);

    return axiosReq
      .get<ApiResponse<StudentClassDetailsResponse>, AxiosResponse<ApiResponse<StudentClassDetailsResponse>>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/student/classes/${id}`,
      )
      .then(async (response) => {
        if (response.status === 200) {
          setClassData({
            id: response.data.payload.id,
            class_name: response.data.payload.class_name,
            description: response.data.payload.description,
            created_user_name: response.data.payload.created_user_name,
            classStudents: response.data.payload.classmates ?? [],
            joined_at: response.data.payload.joined_at,
            type: "existing",
          });
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
  }, [contextType, enabled, handleError, id, organizationId, router, sessionMode, triggerToast, workspace]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [enabled, fetch]);

  return { loading, classData, fetch, apiComplete } as const;
};

export default useGetStudentClassById;
