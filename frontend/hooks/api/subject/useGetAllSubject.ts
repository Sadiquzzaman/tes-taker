import axiosReq from "@/lib/axios";
import { setSubjects } from "@/lib/features/subjectSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "../useApiError";

const mapSubject = (subject: SubjectApiEntry): SubjectCatalogItem => ({
  id: subject.id,
  name: subject.name,
  value: subject.code?.trim() || subject.name,
});

/**
 * Loads the global (individual) subject catalog into Redux.
 * Skipped in organization workspace — org tests use assigned class subjects only.
 */
const useGetAllSubject = () => {
  const dispatch = useAppDispatch();
  const { handleError } = useApiError();
  const { isIndividual } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [hasFetchedSubjectList, setHasFetchedSubjectList] = useState(false);
  const subjectList = useAppSelector((state) => state.subject.subjects);
  const apiComplete = !isIndividual || subjectList.length > 0 || hasFetchedSubjectList;

  const fetch = useCallback(
    async (force = false) => {
      if (!isIndividual) {
        setHasFetchedSubjectList(true);
        return;
      }

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
    [dispatch, handleError, isIndividual, subjectList.length],
  );

  useEffect(() => {
    if (!isIndividual) {
      setHasFetchedSubjectList(true);
      return;
    }

    if (subjectList.length > 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetch, isIndividual, subjectList.length]);

  return { loading, apiComplete, subjectList, fetch } as const;
};

export default useGetAllSubject;
