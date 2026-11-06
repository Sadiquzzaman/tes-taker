"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { isReportError } from "@/utils/attendance/reports";

/**
 * Loads one report (`path` with `params`) whenever they change; a report error code is explained
 * in a toast (`reports.errors`), anything else goes to the usual handler. `path` null waits.
 */
const useReport = <T>(path: string | null, params?: Record<string, string | undefined>) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const tErrors = useTranslations("reports.errors");
  const [data, setData] = useState<{ key: string; payload: T } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = path ? `${path}?${JSON.stringify(params ?? {})}` : "";

  const failedWith = useCallback(
    (error: AxiosError<ApiError>) => {
      const code = error.response?.data?.code;
      if (isReportError(code)) triggerToast({ title: tErrors(code), type: "error" });
      else handleError(error);
    },
    [handleError, tErrors, triggerToast],
  );

  useEffect(() => {
    if (!path) return;
    let live = true;
    const query = JSON.parse(key.slice(key.indexOf("?") + 1)) as Record<string, string | undefined>;
    axiosReq
      .get<ApiResponse<T>>(`${baseUrl}${path}`, { params: query })
      .then((response) => {
        if (!live) return;
        setData({ key, payload: response.data.payload });
        setFailed(null);
      })
      .catch((error: AxiosError<ApiError>) => {
        if (!live) return;
        setFailed(key);
        failedWith(error);
      });
    return () => {
      live = false;
    };
  }, [attempt, baseUrl, failedWith, key, path]);

  return {
    /** The report for the current path and params (an older one is not shown while the next loads). */
    report: data?.key === key ? data.payload : null,
    /** The last report loaded, whatever it was for. */
    latest: data?.payload ?? null,
    failed: failed === key,
    retry: () => setAttempt((value) => value + 1),
  };
};

export default useReport;
