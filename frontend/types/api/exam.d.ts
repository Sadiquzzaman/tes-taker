interface StudentExamOption {
  id: string;
  text: string;
  image: string | null;
}

interface StudentExamMatchingOption {
  id: string;
  text: string;
  image: string | null;
}

type StudentExamQuestionType = "graded" | "ungraded" | "passage-question";
type StudentExamAutoScoredSubType =
  | "multiple-choice"
  | "multiple-response"
  | "true-false"
  | "fill-in-the-blanks"
  | "matching-ordering";
type StudentExamManualSubType = "true-false" | "essay" | "fill-in-the-gaps";
type StudentExamQuestionSubType = StudentExamAutoScoredSubType | StudentExamManualSubType;
type StudentExamQuestionInputMode = "single-select" | "multi-select" | "matching" | "text";

interface StudentExamQuestionBase {
  id: string;
  instruction: string | null;
  image: string | null;
  points: number;
  showValidation: boolean;
}

interface StudentExamStandardQuestion extends StudentExamQuestionBase {
  type: "graded" | "ungraded";
  subType: StudentExamQuestionSubType;
  text: string;
  options?: StudentExamOption[];
  matchingOptions?: {
    left: StudentExamMatchingOption[];
    right: StudentExamMatchingOption[];
  };
  correctOptionId?: string | null;
}

interface StudentExamPassageChildQuestion extends StudentExamQuestionBase {
  type: "passage-question";
  subType: StudentExamAutoScoredSubType;
  text: string;
  options?: StudentExamOption[];
  matchingOptions?: {
    left: StudentExamMatchingOption[];
    right: StudentExamMatchingOption[];
  };
  correctOptionId?: string | null;
}

interface StudentExamPassageQuestion {
  id: string;
  type: "passage-question";
  text?: string;
  instruction?: string | null;
  image?: string | null;
  options?: StudentExamOption[];
  points?: number;
  correctOptionId?: string | null;
  passageText: string;
  childQuestions: StudentExamPassageChildQuestion[];
  showValidation: boolean;
}

type StudentExamSubjectQuestion = StudentExamStandardQuestion | StudentExamPassageQuestion;

interface StudentExamViewQuestion extends StudentExamQuestionBase {
  type: StudentExamQuestionType;
  subType: StudentExamQuestionSubType;
  text: string;
  options?: StudentExamOption[];
  matchingOptions?: {
    left: StudentExamMatchingOption[];
    right: StudentExamMatchingOption[];
  };
  inputMode: StudentExamQuestionInputMode;
  isAutoScored: boolean;
  questionNumber: number;
}

interface StudentExamSingleQuestionItem {
  id: string;
  kind: "single";
  question: StudentExamViewQuestion;
}

interface StudentExamPassageItem {
  id: string;
  kind: "passage";
  passageText: string;
  questions: StudentExamViewQuestion[];
}

type StudentExamViewItem = StudentExamSingleQuestionItem | StudentExamPassageItem;

interface StudentExamViewSection {
  id: string;
  title: string;
  questionCount: number;
  items: StudentExamViewItem[];
}

interface StudentExamViewSummary {
  subjectSummary: string;
  totalMarks: number;
  totalQuestions: number;
}

interface StudentExamViewModel {
  summary: StudentExamViewSummary;
  sections: StudentExamViewSection[];
}

interface StudentExamQuestion {
  id: string;
  type?: StudentExamQuestionType;
  subType?: StudentExamQuestionSubType;
  text: string;
  image: string | null;
  options?: StudentExamOption[];
  matchingOptions?: {
    left: StudentExamMatchingOption[];
    right: StudentExamMatchingOption[];
  };
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
  questions: StudentExamSubjectQuestion[];
}

interface StudentExamFormState {
  testName: string;
  duration: number;
  passingScore: number | string;
  allowNegativeMarking: boolean;
  negativeMarking: number | string;
  allowScreenShare: boolean;
  screenShareDisqualifySeconds: number;
}

interface StudentExamPublishState {
  publishTiming: "now" | "later";
  scheduleAt: string | null;
  endingAt: string | null;
  testAudience: "anyone" | "selected_class";
  selectedClassId: string;
}

interface TeacherExamPublishState {
  publishTiming: PublishTiming;
  scheduleAt: string | null;
  endingAt: string | null;
  testAudience: TestAudience;
  selectedClassId: string;
  excluded_students: string[];
  specificStudents: string[];
}

interface StudentExamDetails {
  id: string;
  test_name: string;
  status: "ongoing" | "completed" | "pending";
  formState: StudentExamFormState;
  publishState: StudentExamPublishState;
  subjects: StudentExamSubject[];
  class_id: string | null;
  class_name: string | null;
  remaining_time_seconds?: number;
  effective_deadline?: string;
  submission_status?: string | null;
}

interface TeacherExamListItem {
  id: string;
  test_name: string;
  status: "ongoing" | "completed" | "pending";
  formState: StudentExamFormState;
  publishState: TeacherExamPublishState;
  subjects: StudentExamSubject[];
  class_id: string | null;
  class_name: string | null;
  created_by: string;
  created_user_name: string;
  created_at: string;
  updated_at: string | null;
  participant_count: number;
  submitted_count: number;
}

interface StudentAssignedExamListItem {
  id: string;
  test_name: string;
  subject: string;
  test_audience: TestAudience;
  duration_minutes: number;
  exam_start_time: string;
  exam_end_time: string;
  class_id: string | null;
  class_name: string | null;
  created_user_name: string;
  status: "ongoing" | "completed" | "pending";
  participant_count: number;
  submitted_count: number;
}

type TestListItem = TeacherExamListItem | StudentAssignedExamListItem;
type TeacherShareableTest = TeacherExamListItem | ITest;

interface ITest {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string | null;
  updated_user_name: string | null;
  created_at: string;
  updated_at: string | null;
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
  class_name?: string | null;
  class: Class | null;
  excluded_students: unknown[];
  target_students: unknown[];
  participant_count?: number;
  submitted_count?: number;
  status: "ongoing" | "completed" | "pending";
  subjects: StudentExamSubject[];
}
