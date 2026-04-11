interface Test {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string;
  updated_user_name: string;
  created_at: string;
  updated_at: string;
  exam_type: string;
  exam_start_time: string;
  exam_end_time: string;
  is_negative_marking: boolean;
  negative_mark_value: any;
  subject: string;
  class_id: string;
  class: Class;
  excluded_students: any[];
  questions: Question[];
}

interface Question {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string;
  updated_user_name: string;
  created_at: string;
  updated_at: string;
  question_type: string;
  question: string;
  option1: any;
  option2: any;
  option3: any;
  option4: any;
  correct_answer: any;
  explanation: any;
  expected_word_limit: number;
  marks_per_question: number;
  sample_answer: string;
}

type NewTestShareData = {
  id: string;
  testName: string;
  shareLink: string;
  type?: "new" | "existing";
  test: CreateTestState;
};
