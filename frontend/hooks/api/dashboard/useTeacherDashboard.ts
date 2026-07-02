import axiosReq from "@/lib/axios";
import { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

const useTeacherDashboard = (query: TeacherDashboardQuery = {}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeacherDashboardPayload | null>(null);
  const queryRef = useRef(query);

  queryRef.current = query;

  const fetchDashboard = useCallback(async (params: TeacherDashboardQuery = queryRef.current) => {
    setLoading(true);
    setError(null);

    const searchParams = new URLSearchParams();
    if (params.activity_period) {
      searchParams.set("activity_period", params.activity_period);
    }
    if (params.calendar_year != null) {
      searchParams.set("calendar_year", String(params.calendar_year));
    }
    if (params.calendar_month != null) {
      searchParams.set("calendar_month", String(params.calendar_month));
    }

    const queryString = searchParams.toString();
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/teacher${queryString ? `?${queryString}` : ""}`;

    return axiosReq
      .get<ApiResponse<TeacherDashboardPayload>, AxiosResponse<ApiResponse<TeacherDashboardPayload>>>(url)
      .then((response) => {
        if (response.status === 200) {
          setData(response.data.payload);
        }
      })
      .catch((err: AxiosError<ApiError>) => {
        const message =
          typeof err.response?.data?.message === "string"
            ? err.response.data.message
            : "Failed to load dashboard data.";
        setError(message);
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void fetchDashboard(query);
  }, [fetchDashboard, query.activity_period, query.calendar_year, query.calendar_month]);

  return {
    data,
    loading,
    error,
    refetch: fetchDashboard,
  } as const;
};

export default useTeacherDashboard;
