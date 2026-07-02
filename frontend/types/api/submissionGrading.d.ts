type SubmissionGradingQuestionType = "graded" | "ungraded" | "passage-question";

type SubmissionGradingAutoSubType =
  | "multiple-choice"
  | "multiple-response"
  | "true-false"
  | "fill-in-the-blanks"
  | "matching-ordering";

type SubmissionGradingManualSubType = "true-false" | "essay" | "fill-in-the-gaps";

type SubmissionGradingQuestionSubType = SubmissionGradingAutoSubType | SubmissionGradingManualSubType;

interface SubmissionGradingOptionApi {
  id: string;
  text: string;
  image_url: string | null;
}

interface SubmissionGradingMatchingOptionApi {
  id: string;
  text: string;
  image: string | null;
}

interface SubmissionGradingOptionAnswerApi {
  type: "optionId";
  correct_answer: string[];
  student_selected: string[];
}

interface SubmissionGradingMatchingAnswerApi {
  type: "matchingOrdering";
  correct_answer: string[];
  student_selected: string[];
}

interface SubmissionGradingTextAnswerApi {
  type: "text";
  student_answer: string;
}

type SubmissionGradingAnswerApi =
  | SubmissionGradingOptionAnswerApi
  | SubmissionGradingMatchingAnswerApi
  | SubmissionGradingTextAnswerApi;

interface SubmissionGradingQuestionBaseApi {
  question_id: string;
  question: string;
  instruction: string;
  image_url: string | null;
  points: number;
  sub_type: SubmissionGradingQuestionSubType;
  answer: SubmissionGradingAnswerApi;
  is_correct: boolean | null;
  marks_obtained: number;
  options?: SubmissionGradingOptionApi[];
  matchingOptions?: {
    left: SubmissionGradingMatchingOptionApi[];
    right: SubmissionGradingMatchingOptionApi[];
  };
}

interface SubmissionGradingGradedQuestionApi extends SubmissionGradingQuestionBaseApi {
  type: "graded";
}

interface SubmissionGradingUngradedQuestionApi extends SubmissionGradingQuestionBaseApi {
  type: "ungraded";
}

interface SubmissionGradingPassageChildQuestionApi extends SubmissionGradingQuestionBaseApi {
  type: "passage-question";
}

type SubmissionGradingQuestionApi =
  | SubmissionGradingGradedQuestionApi
  | SubmissionGradingUngradedQuestionApi
  | SubmissionGradingPassageChildQuestionApi;

interface SubmissionGradingPassageQuestionApi {
  id: string;
  type: "passage-question";
  passageText: string;
  childQuestions: SubmissionGradingPassageChildQuestionApi[];
}

type SubmissionGradingQuestionItemApi =
  | SubmissionGradingQuestionApi
  | SubmissionGradingPassageQuestionApi;

interface SubmissionGradingSubmissionApi {
  submission_id: string;
  exam_id: string;
  student_id: string;
  student_name: string | null;
  email: string | null;
  phone: string | null;
  submitted_at: string | null;
  status: string;
  total_score: number;
  max_score: number;
  percentage: number;
  is_graded: boolean;
  grading_status: SubmissionGradingStatus;
}

interface SubmissionGradingTotalsApi {
  manual_total_count: number;
  manual_graded_count: number;
  auto_total_count: number;
  auto_graded_count: number;
}

interface SubmissionGradingDetailPayload {
  submission: SubmissionGradingSubmissionApi;
  questions: SubmissionGradingQuestionItemApi[];
  totals: SubmissionGradingTotalsApi;
}
