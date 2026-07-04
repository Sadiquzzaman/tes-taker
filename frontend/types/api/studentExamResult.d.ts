interface StudentExamResultAnswer {
  question: string;
  question_type: string;
  selected_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean | null;
  marks_obtained: number | null;
  explanation: string | null;
  text_answer: string | null;
  word_count: number | null;
}

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
  percentage: string | null;
  answers: StudentExamResultAnswer[];
}
