type GradingStatus = 'NEEDS_GRADING' | 'GRADED' | 'PUBLISHED';

type SubmissionGradingStatus = 'PENDING' | 'GRADED';

interface GradingListQuery {
  status?: GradingStatus;
  page?: number;
  limit?: number;
  search?: string;
}

interface GradingSummaryQuery {
  page?: number;
  limit?: number;
  search?: string;
}

interface GradingPaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface GradingListItem {
  id: string;
  test_name: string | null;
  subject: string | null;
  class_name: string | null;
  exam_end_time: string;
  lifecycle_status: 'pending' | 'ongoing' | 'completed';
  total_participants: number;
  submitted_count: number;
  graded_count: number;
  pending_count: number;
  average_percentage: number | null;
  has_manual_questions: boolean;
  is_result_published: boolean;
  result_published_at: string | null;
  grading_status: GradingStatus;
}

interface GradingExamSummary {
  id: string;
  test_name: string | null;
  subject: string | null;
  class_name: string | null;
  total_marks: number;
  has_manual_questions: boolean;
  grading_status: GradingStatus;
  is_result_published: boolean;
  result_published_at: string | null;
  passing_score: number | null;
  exam_end_time: string;
}

interface GradingExamStats {
  total_students: number;
  submissions: number;
  not_submitted: number;
  graded: number;
  pending: number;
  average_percentage: number | null;
}

interface GradingSubmissionListItem {
  submission_id: string;
  student_id: string;
  student_name: string | null;
  email: string | null;
  phone: string | null;
  submitted_at: string | null;
  status: string;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  is_graded: boolean;
  grading_status: SubmissionGradingStatus;
}

interface GradingSummaryResponse {
  exam: GradingExamSummary;
  stats: GradingExamStats;
  submissions: GradingSubmissionListItem[];
  meta: GradingPaginationMeta;
}

interface SubmissionOption {
  id: string;
  text: string;
  image_url: string | null;
}

interface SubmissionMatchingOption {
  id: string;
  text: string;
  image: string | null;
}

interface SubmissionAnswerOptionId {
  type: 'optionId';
  correct_answer: string[];
  student_selected: string[];
}

interface SubmissionAnswerMatchingOrdering {
  type: 'matchingOrdering';
  correct_answer: string[];
  student_selected: string[];
}

interface SubmissionAnswerText {
  type: 'text';
  student_answer: string;
}

type SubmissionAnswer =
  | SubmissionAnswerOptionId
  | SubmissionAnswerMatchingOrdering
  | SubmissionAnswerText;

interface SubmissionQuestion {
  question_id: string;
  question: string;
  instruction: string;
  image_url: string | null;
  points: number;
  type: string;
  sub_type: string;
  options?: SubmissionOption[];
  matchingOptions?: {
    left: SubmissionMatchingOption[];
    right: SubmissionMatchingOption[];
  };
  answer: SubmissionAnswer;
  is_correct: boolean | null;
  marks_obtained: number;
}

interface SubmissionPassageQuestion {
  id: string;
  type: 'passage-question';
  passageText: string;
  childQuestions: SubmissionQuestion[];
}

type SubmissionQuestionItem = SubmissionQuestion | SubmissionPassageQuestion;

interface SubmissionGradingDetail {
  submission: {
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
  };
  questions: SubmissionQuestionItem[];
  totals: {
    manual_total_count: number;
    manual_graded_count: number;
    auto_total_count: number;
    auto_graded_count: number;
  };
}

interface QuestionGradeInput {
  question_id: string;
  marks_obtained: number;
}

interface SaveSubmissionGradesPayload {
  grades: QuestionGradeInput[];
}

interface SaveSubmissionGradesResponse {
  submission_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  is_graded: boolean;
  grading_status: SubmissionGradingStatus;
  manual_graded_count: number;
  manual_total_count: number;
}

interface PublishResultResponse {
  is_result_published: boolean;
  result_published_at: string;
  grading_status: 'PUBLISHED';
}
