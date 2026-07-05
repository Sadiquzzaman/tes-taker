import "server-only";

import { cache } from "react";
import { fetchServerApiJson } from "@/lib/server/fetchServerApi";

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

  const { result, errorMessage } = await fetchServerApiJson<
    JoinClassApiResponse | JoinClassErrorResponse
  >(`/classes/${encodeURIComponent(trimmedClassId)}`, "getJoinClassById");

  if (!result) {
    return {
      classData: null,
      apiResponse: null,
      errorMessage: errorMessage ?? "Class service is not configured.",
    };
  }

  const responseBody = result.data;

  if (!result.ok) {
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
});

export default getJoinClassById;
