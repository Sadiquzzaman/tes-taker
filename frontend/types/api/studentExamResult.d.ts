interface StudentExamResultPayload {
  exam_id: string;
  subject: string | null;
  exam_type: string | null;
  submitted_at: string | null;
  status: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  submission: SubmissionGradingSubmissionApi;
  questions: SubmissionGradingQuestionItemApi[];
  totals: SubmissionGradingTotalsApi;
}
