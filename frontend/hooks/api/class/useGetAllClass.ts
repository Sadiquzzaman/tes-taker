import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useApiError } from "../useApiError";

type T = ApiResponse<Class[]>;
type R = AxiosResponse<T>;
type E = AxiosError<ApiError>;

const useGetAllClass = () => {
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const [classList, setClassList] = useState<Class[]>([]);

  const fetch = async () => {
    setLoading(true);

    return axiosReq
      .get<T, R>(`${process.env.NEXT_PUBLIC_BASE_URL}/classes`)
      .then(async (response) => {
        if (response.status === 200) {
          setClassList(response.data.payload);
        }
      })
      .catch((error: E) => {
        handleError(error);
      })
      .finally(() => {
        setLoading(false);
        setApiComplete(true);
      });
  };

  useEffect(() => {
    fetch();
  }, []);

  return { loading, classList, fetch, apiComplete } as const;
};

export default useGetAllClass;

const defaultResponse = {
  statusCode: 200,
  message: "Classes retrieved successfully",
  payload: [
    {
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
      students: [],
    },
    {
      id: "be4864cd-c7f9-4de0-82e0-13a7afcb58a8",
      is_active: 1,
      created_by: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
      created_user_name: "Sahriar Kabir",
      updated_by: null,
      updated_user_name: null,
      created_at: "2026-03-10T18:09:26.279Z",
      updated_at: null,
      class_name: "Class 8A",
      description: "",
      teacher_id: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
      students: [],
    },
    {
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
      students: [],
    },
    {
      id: "199cb083-f783-4dee-ba52-fde3aa878e9b",
      is_active: 1,
      created_by: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
      created_user_name: "Sahriar Kabir",
      updated_by: null,
      updated_user_name: null,
      created_at: "2026-03-09T21:03:25.407Z",
      updated_at: null,
      class_name: "Math101",
      description: "",
      teacher_id: "bda193fa-42cd-4405-b9a2-fee84cf12d8c",
      students: [],
    },
  ],
  error: false,
};
