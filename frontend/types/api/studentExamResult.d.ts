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
  /** On the exam organisation's grading scale (FND-11). */
  grade?: Grade | null;
  submission: SubmissionGradingSubmissionApi;
  questions: SubmissionGradingQuestionItemApi[];
  totals: SubmissionGradingTotalsApi;
}
