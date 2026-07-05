import "server-only";

import { getServerApiBaseUrls } from "@/lib/server/getServerApiBaseUrl";

export interface ServerApiFetchResult<T> {
  ok: boolean;
  status: number;
  statusText: string;
  baseUrl: string;
  data: T | null;
}

export const fetchServerApiJson = async <T>(
  path: string,
  logLabel: string,
): Promise<{ result: ServerApiFetchResult<T> | null; errorMessage: string | null }> => {
  const baseUrls = getServerApiBaseUrls();

  if (baseUrls.length === 0) {
    return {
      result: null,
      errorMessage: "API service is not configured.",
    };
  }

  let lastNetworkError: unknown = null;

  for (const baseUrl of baseUrls) {
    const requestUrl = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    console.info(`[${logLabel}] Fetching server API`, {
      baseUrl,
      requestUrl,
      inDocker: process.env.RUNNING_IN_DOCKER === "true",
      configuredUrls: baseUrls,
    });

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          Accept: "*/*",
        },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as T | null;

      if (!response.ok) {
        console.error(`[${logLabel}] Non-OK response`, {
          baseUrl,
          requestUrl,
          status: response.status,
          statusText: response.statusText,
          data,
        });
      } else {
        console.info(`[${logLabel}] Fetch succeeded`, {
          baseUrl,
          requestUrl,
          status: response.status,
        });
      }

      return {
        result: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          baseUrl,
          data,
        },
        errorMessage: null,
      };
    } catch (error) {
      lastNetworkError = error;
      console.error(`[${logLabel}] Network error`, {
        baseUrl,
        requestUrl,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  console.error(`[${logLabel}] All server API candidates failed`, {
    baseUrls,
    error: lastNetworkError instanceof Error ? lastNetworkError.message : lastNetworkError,
  });

  return {
    result: null,
    errorMessage: "Unable to load details right now.",
  };
};
