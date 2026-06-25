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

interface ManualGradingQuestion {
  question_id: string;
  question: string;
  instruction: string | null;
  image_url: string | null;
  points: number;
  sub_type: string | null;
  sample_answer: string | null;
  expected_word_limit: number | null;
  student_answer: {
    text_answer: string | null;
    word_count: number | null;
  };
  marks_obtained: number | null;
  is_graded: boolean;
}

interface AutoGradingQuestion {
  question_id: string;
  question: string;
  instruction: string | null;
  image_url: string | null;
  points: number;
  sub_type: string | null;
  options: Array<{
    id: string;
    text: string;
    is_correct: boolean;
  }>;
  student_selected: string | null;
  selected_answer: string | null;
  text_answer: string | null;
  is_correct: boolean | null;
  marks_obtained: number | null;
}

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
    total_score: number | null;
    max_score: number | null;
    percentage: number | null;
    is_graded: boolean;
    grading_status: SubmissionGradingStatus;
  };
  manual_questions: ManualGradingQuestion[];
  auto_questions: AutoGradingQuestion[];
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
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
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
