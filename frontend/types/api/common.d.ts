interface ApiResponse<T> {
  statusCode: number;
  message: string;
  payload: T;
  error: boolean;
}

interface ApiError {
  statusCode: number;
  error: boolean;
  timestamp: string;
  path: string;
  message: ErrorMessage;
  /** Machine-readable reason (design §8.3), e.g. FEATURE_NOT_IN_PLAN. */
  code?: string;
  /** With FEATURE_NOT_IN_PLAN: the feature key. */
  feature?: string;
  /** With PLAN_LIMIT_REACHED: the limit key. */
  limit?: string;
}

type ErrorMessage =
  | string
  | {
      message: string[];
    };
