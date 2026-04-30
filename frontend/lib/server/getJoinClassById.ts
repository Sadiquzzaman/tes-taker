import "server-only";

import { cache } from "react";

const DEFAULT_ERROR_MESSAGE = "Class not found or unavailable.";

const getErrorMessage = (responseBody: JoinClassErrorResponse | null) => {
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

const getJoinClassById = cache(async (classId: string): Promise<JoinClassResult> => {
  const trimmedClassId = classId.trim();

  if (!trimmedClassId) {
    return {
      classData: null,
      apiResponse: null,
      errorMessage: DEFAULT_ERROR_MESSAGE,
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL;

  if (!baseUrl) {
    return {
      classData: null,
      apiResponse: null,
      errorMessage: "Class service is not configured.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/classes/${encodeURIComponent(trimmedClassId)}`, {
      method: "GET",
      headers: {
        Accept: "*/*",
      },
      cache: "no-store",
    });

    const responseBody = (await response.json().catch(() => null)) as
      | JoinClassApiResponse
      | JoinClassErrorResponse
      | null;

    if (!response.ok) {
      return {
        classData: null,
        apiResponse: null,
        errorMessage: getErrorMessage(responseBody as JoinClassErrorResponse | null),
      };
    }

    const apiResponse = responseBody as JoinClassApiSuccessResponse | null;
    const payload = apiResponse?.payload;

    if (!payload) {
      return {
        classData: null,
        apiResponse: null,
        errorMessage: DEFAULT_ERROR_MESSAGE,
      };
    }

    return {
      apiResponse,
      classData: {
        class_name: payload.class_name,
        description: payload.description,
        created_user_name: payload.created_user_name,
      },
      errorMessage: null,
    };
  } catch {
    return {
      classData: null,
      apiResponse: null,
      errorMessage: "Unable to load class details right now.",
    };
  }
});

export default getJoinClassById;
