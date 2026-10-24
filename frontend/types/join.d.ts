type JoinClassPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

type JoinTestPageProps = {
  params: Promise<{
    testId: string;
  }>;
};

/** A message key under `join` in messages/en.json (the join pages show it in the user's language). */
type JoinMessageKey = keyof (typeof import("@/messages/en.json"))["join"];

interface IJoinClass {
  status: "loading" | "error" | "pending" | "joined" | "success";
  /** Why the request can't be shown (status "error"). */
  errorKey?: JoinMessageKey;
  studentName?: string;
  className?: string;
  teacher?: string;
}

interface IJoinTest {
  status: "loading" | "error" | "success";
  errorKey?: JoinMessageKey;
  errorTitleKey?: JoinMessageKey;
  studentName?: string;
  test?: string;
  teacher?: string;
  time?: number;
  testId?: string;
}

type JoinClassApiPayload = {
  class_name: string;
  description: string;
  created_user_name: string;
};

type JoinClassApiResponse = {
  statusCode: number;
  message: string;
  payload?: JoinClassApiPayload;
  error: boolean;
};

type JoinClassApiSuccessResponse = JoinClassApiResponse & {
  payload: JoinClassApiPayload;
};

type JoinClassErrorResponse = {
  statusCode?: number;
  message?: string | { message?: string[] };
  error?: boolean;
};

type JoinClassResult = {
  classData: JoinClassApiPayload | null;
  apiResponse: JoinClassApiSuccessResponse | null;
  errorMessage: string | null;
};

type JoinClassPreview = {
  class_name: string;
  description: string;
  created_user_name: string;
};

type JoinClassApiResponse = {
  statusCode: number;
  message: string;
  payload: JoinClassPreview;
  error: boolean;
};

type JoinClassModalProps = {
  classData?: JoinClassPreview | null;
  classId: string;
  apiResponse?: JoinClassApiResponse | null;
  errorMessage?: string | null;
};

type JoinTestApiPayload = {
  description: string;
  test_name: string;
  created_user_name: string;
  duration_minutes: number;
  test_audience: TestAudience;
};

type JoinTestApiResponse = {
  statusCode: number;
  message: string;
  payload?: JoinTestApiPayload;
  error: boolean;
};

type JoinTestApiSuccessResponse = JoinTestApiResponse & {
  payload: JoinTestApiPayload;
};

type JoinTestErrorResponse = {
  statusCode?: number;
  message?: string | { message?: string[] };
  error?: boolean;
};

type JoinTestResult = {
  testData: JoinTestApiPayload | null;
  apiResponse: JoinTestApiSuccessResponse | null;
  errorMessage: string | null;
};

type JoinTestPreview = {
  description: string;
  test_name: string;
  created_user_name: string;
  duration_minutes: number;
  test_audience: TestAudience;
};

type JoinTestApiResponse = {
  statusCode: number;
  message: string;
  payload: JoinTestPreview;
  error: boolean;
};

type JoinTestModalProps = {
  testData?: JoinTestPreview | null;
  testId: string;
  apiResponse?: JoinTestApiResponse | null;
  errorMessage?: string | null;
};
