import "server-only";

import { cache } from "react";

const DEFAULT_ERROR_MESSAGE = "Test not found or unavailable.";

const getErrorMessage = (responseBody: JoinTestErrorResponse | null) => {
  if (!responseBody?.message) {
    return DEFAULT_ERROR_MESSAGE;
  }

  if (typeof responseBody.message === "string") {
    return responseBody.message;
  }

  if (Array.isArray(responseBody.message.message) && responseBody.message.message.length > 0) {
    return responseBody.message.message[0];
  }

  return DEFAULT_ERROR_MESSAGE;
};

const getJoinTestById = cache(async (testId: string): Promise<JoinTestResult> => {
  const trimmedTestId = testId.trim();

  if (!trimmedTestId) {
    return {
      testData: null,
      apiResponse: null,
      errorMessage: DEFAULT_ERROR_MESSAGE,
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL;

  if (!baseUrl) {
    return {
      testData: null,
      apiResponse: null,
      errorMessage: "Test service is not configured.",
    };
  }

  try {
    console.log({ baseUrl, testId: trimmedTestId });
    const response = await fetch(`${baseUrl}/exams/${encodeURIComponent(trimmedTestId)}`, {
      method: "GET",
      headers: {
        Accept: "*/*",
      },
      cache: "no-store",
    });
    console.log({ response });

    const responseBody = (await response.json().catch(() => null)) as
      | JoinTestApiResponse
      | JoinTestErrorResponse
      | null;

    if (!response.ok) {
      return {
        testData: null,
        apiResponse: null,
        errorMessage: getErrorMessage(responseBody as JoinTestErrorResponse | null),
      };
    }

    const apiResponse = responseBody as JoinTestApiSuccessResponse | null;
    const payload = apiResponse?.payload;

    if (!payload) {
      return {
        testData: null,
        apiResponse: null,
        errorMessage: DEFAULT_ERROR_MESSAGE,
      };
    }

    return {
      apiResponse,
      testData: {
        description: "",
        test_name: payload.test_name,
        created_user_name: payload.created_user_name,
        duration_minutes: payload.duration_minutes,
        test_audience: payload.test_audience,
      },
      errorMessage: null,
    };
  } catch {
    return {
      testData: null,
      apiResponse: null,
      errorMessage: "Unable to load test details right now.",
    };
  }
});

export default getJoinTestById;
