interface ApiError {
  statusCode: number;
  error: boolean;
  timestamp: string;
  path: string;
  message: ErrorMessage;
}

type ErrorMessage =
  | string
  | {
      message: string[];
    };
