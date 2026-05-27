import axiosReq from "@/lib/axios";
import { setSubjects } from "@/lib/features/subjectSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";

const mapSubject = (subject: SubjectApiEntry): SubjectCatalogItem => ({
  id: subject.id,
  name: subject.name,
  value: subject.code?.trim() || subject.name,
});

const useGetAllSubject = () => {
  const dispatch = useAppDispatch();
  const { handleError } = useApiError();
  const [loading, setLoading] = useState(false);
  const [hasFetchedSubjectList, setHasFetchedSubjectList] = useState(false);
  const subjectList = useAppSelector((state) => state.subject.subjects);
  const apiComplete = subjectList.length > 0 || hasFetchedSubjectList;

  const fetch = useCallback(
    async (force = false) => {
      if (!force && subjectList.length > 0) {
        setHasFetchedSubjectList(true);
        return;
      }

      setLoading(true);

      return axiosReq
        .get<ApiResponse<SubjectApiEntry[]>, AxiosResponse<ApiResponse<SubjectApiEntry[]>>>(
          `${process.env.NEXT_PUBLIC_BASE_URL}/subjects`,
        )
        .then((response) => {
          if (response.status === 200) {
            dispatch(setSubjects(response.data.payload.map(mapSubject)));
          }
        })
        .catch((error: AxiosError<ApiError>) => {
          handleError(error);
        })
        .finally(() => {
          setLoading(false);
          setHasFetchedSubjectList(true);
        });
    },
    [dispatch, handleError, subjectList.length],
  );

  useEffect(() => {
    if (subjectList.length > 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetch, subjectList.length]);

  return { loading, apiComplete, subjectList, fetch } as const;
};

export default useGetAllSubject;
