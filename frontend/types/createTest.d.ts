type FormState = {
  testName: string;
  duration: string;
  passingScore: string;
  allowNegativeMarking: boolean;
  negativeMarking: string;
};

type BasicInfoErrors = {
  testName?: string;
  duration?: string;
  negativeMarking?: string;
};

type QuestionOption = {
  id: string;
  text: string;
  image: string | null;
};

type CreateTestQuestionCategory = "graded" | "ungraded" | "other";

type QuestionItem = {
  id: string;
  type: CreateTestQuestionCategory;
  subType: string;
  text: string;
  instruction: string;
  image: string | null;
  options?: QuestionOption[];
  correctOptionId?: string | null;
  points: number;
  showValidation: boolean;
};

type QuestionSectionType = "objective" | "essay";

type SubjectItem = {
  id: string;
  name: string;
  value: string;
  type: CreateTestQuestionCategory | "";
  questions: QuestionItem[];
};

type DragState = {
  subjectId: string;
  id: string;
  draggedOriginalIndex: number;
  dropLineIndex: number;
  height: number;
  left: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  pointerX: number;
  pointerY: number;
  width: number;
};

type BasicInfoStepProps = {
  formState: FormState;
};

type CreateTestStep = "Basic info" | "Questions" | "Review" | "Publish";

type PendingFocusQuestion = {
  subjectId: string;
  questionId: string;
};

type PendingFocusOption = {
  subjectId: string;
  questionId: string;
  optionId: string;
};

type PublishTiming = "immediately" | "later";

type TestAudience = "anyone" | "selected_class" | "specific_students";

type PublishState = {
  publishTiming: PublishTiming;
  scheduleAt: string;
  endingAt: string;
  testAudience: TestAudience;
  selectedClassId: string;
  excluded_students: string[];
};

type PublishStateForPayload = {
  publishTiming: PublishTiming;
  scheduleAt: string;
  endingAt: string;
  testAudience: TestAudience;
  selectedClassId?: string;
  excluded_students?: string[];
};

type CreateTestState = {
  currentStep: CreateTestStep;
  formState: FormState;
  subjects: SubjectItem[];
  activeSubjectId: string | null;
  activeQuestionId: string | null;
  pendingFocusQuestion: PendingFocusQuestion | null;
  pendingFocusOption: PendingFocusOption | null;
  dragState: DragState | null;
  publishState: PublishState;
};

type QuestionsStepProps = {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
};

type QuestionCardProps = {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  subjectId: string;
  setCardRef: (node: HTMLDivElement | null) => void;
  question: QuestionItem;
  questionNumber: number;
  isActive: boolean;
  shouldAutoFocus: boolean;
  pendingFocusOptionId: string | null;
  isDragging: boolean;
  isDragOverlay?: boolean;
  cardStyle?: React.CSSProperties;
  overlayStyle?: React.CSSProperties;
  onDragHandlePointerDown: (
    subjectId: string,
    questionId: string,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
};

type CreateTestSubmissionQuestionItem = Omit<QuestionItem, "type"> & {
  type: QuestionSectionType;
};

type CreateTestSubmissionSubjectItem = Omit<SubjectItem, "type" | "questions"> & {
  type: QuestionSectionType | "";
  questions: CreateTestSubmissionQuestionItem[];
};

interface CreateTestPayload {
  formState: FormState;
  subjects: CreateTestSubmissionSubjectItem[];
  publishState: PublishStateForPayload;
}

interface Subject {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string | null;
  updated_user_name: string | null;
  created_at: string;
  updated_at: string | null;
  name: string;
  code: string;
}
