import axiosReq from "@/lib/axios";
import { setSubjects } from "@/lib/features/subjectSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { AxiosError, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useApiError } from "../useApiError";

type SubjectResponse = {
  id: string;
  name: string;
  code: string | null;
};

type T = ApiResponse<SubjectResponse[]>;
type R = AxiosResponse<T>;
type E = AxiosError<ApiError>;

const mapSubject = (subject: SubjectResponse) => ({
  id: subject.id,
  name: subject.name,
  value: subject.code?.trim() || subject.name,
});

const useGetAllSubject = () => {
  const dispatch = useAppDispatch();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const subjectList = useAppSelector((state) => state.subject.subjects);

  const fetch = async (force = false) => {
    if (!force && subjectList.length > 0) {
      setApiComplete(true);
      return;
    }

    setLoading(true);

    return axiosReq
      .get<T, R>(`${process.env.NEXT_PUBLIC_BASE_URL}/subjects`)
      .then((response) => {
        if (response.status === 200) {
          dispatch(setSubjects(response.data.payload.map(mapSubject)));
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
    if (subjectList.length > 0) {
      setApiComplete(true);
      return;
    }

    fetch();
  }, [subjectList.length]);

  return { loading, apiComplete, subjectList, fetch } as const;
};

export default useGetAllSubject;
