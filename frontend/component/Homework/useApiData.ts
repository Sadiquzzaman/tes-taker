"use client";

import { AxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import axiosReq from "@/lib/axios";

/**
 * Loads `path` (with `params`) whenever they change, like the reports' useReport. `reload` asks
 * again; `setData` replaces what is shown (after a save). `failed` is the HTTP status, or 0.
 */
const useApiData = <T>(path: string, params?: Record<string, string | undefined>) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [state, setState] = useState<{ key: string; data: T | null; failed: number | null }>({ key: "", data: null, failed: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${path}?${JSON.stringify(params ?? {})}`;

  useEffect(() => {
    let live = true;
    const query = JSON.parse(key.slice(key.indexOf("?") + 1)) as Record<string, string | undefined>;
    axiosReq
      .get<{ payload: T }>(`${baseUrl}${path}`, { params: query })
      .then((response) => {
        if (live) setState({ key, data: response.data.payload, failed: null });
      })
      .catch((error: AxiosError) => {
        if (live) setState({ key, data: null, failed: error.response?.status ?? 0 });
      });
    return () => {
      live = false;
    };
  }, [attempt, baseUrl, key, path]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    failed: current ? state.failed : null,
    reload: useCallback(() => setAttempt((value) => value + 1), []),
    setData: useCallback((data: T) => setState((previous) => ({ ...previous, data })), []),
  };
};

export default useApiData;
