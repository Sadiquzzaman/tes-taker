type NewTestShareData = {
  type?: "new" | "existing";
  test: ITest;
};

interface ITest {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: any;
  updated_user_name: any;
  created_at: string;
  updated_at: any;
  exam_type: string;
  test_name: string;
  subjects: SubjectItem[];
  duration_minutes: number;
  passing_score: number;
  publish_timing: string;
  test_audience: TestAudience;
  invite_token: any;
  exam_start_time: string;
  exam_end_time: string;
  is_negative_marking: boolean;
  negative_mark_value: any;
  subject: string;
  class_id: string;
  class: Class;
  excluded_students: any[];
  target_students: any[];
  questionSections: QuestionSectionItem[];
  questions: QuestionItem[];
}
