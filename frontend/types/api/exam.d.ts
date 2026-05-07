interface StudentExamOption {
  id: string;
  text: string;
  image: string | null;
}

interface StudentExamQuestion {
  id: string;
  text: string;
  image: string | null;
  options?: StudentExamOption[];
  points: number;
  instruction: string | null;
  showValidation: boolean;
  correctOptionId?: string | null;
}

interface StudentExamQuestionSection {
  id: string;
  type: QuestionSectionType;
  headerText: string;
  questions: StudentExamQuestion[];
}

interface StudentExamSubject {
  id: string;
  name: string;
  code: string | null;
  questionSections: StudentExamQuestionSection[];
}

interface ITest {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string | null;
  updated_user_name: string | null;
  created_at: string;
  updated_at: string | null;
  exam_type: string;
  test_name: string;
  duration_minutes: number;
  passing_score: number;
  publish_timing: PublishTiming;
  test_audience: TestAudience;
  exam_start_time: string;
  exam_end_time: string;
  is_negative_marking: boolean;
  negative_mark_value: number;
  subject: string;
  class_id: string | null;
  class: Class | null;
  excluded_students: unknown[];
  target_students: unknown[];
  status: "ongoing" | "completed" | "pending";
  subjects: StudentExamSubject[];
}