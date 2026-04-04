type FormState = {
  examType: string;
  testName: string;
  subject: string;
  duration: string;
  passingScore: string;
  allowNegativeMarking: boolean;
  negativeMarking: string;
};

type BasicInfoErrors = {
  examType?: string;
  testName?: string;
  subject?: string;
  duration?: string;
  negativeMarking?: string;
};

type QuestionOption = {
  id: string;
  text: string;
};

type QuestionItem = {
  id: string;
  text: string;
  options?: QuestionOption[];
  correctOptionId?: string | null;
  points: number;
  showValidation: boolean;
};

type QuestionSectionType = "objective" | "essay";

type QuestionSectionItem = {
  id: string;
  type: QuestionSectionType;
  headerText: string;
  questions: QuestionItem[];
};

type DragState = {
  sectionId: string;
  id: string;
  draggedOriginalIndex: number;
  dropLineIndex: number;
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
  sectionId: string;
  questionId: string;
};

type PendingFocusOption = {
  sectionId: string;
  questionId: string;
  optionId: string;
};

type CreateTestState = {
  currentStep: CreateTestStep;
  formState: FormState;
  questionSections: QuestionSectionItem[];
  activeQuestionId: string | null;
  pendingFocusQuestion: PendingFocusQuestion | null;
  pendingFocusOption: PendingFocusOption | null;
  dragState: DragState | null;
};

type QuestionsStepProps = {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
};

type QuestionCardProps = {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  sectionId: string;
  sectionType: QuestionSectionType;
  setCardRef: (node: HTMLDivElement | null) => void;
  question: QuestionItem;
  questionNumber: number;
  isActive: boolean;
  shouldAutoFocus: boolean;
  pendingFocusOptionId: string | null;
  isDragging: boolean;
  isDragOverlay?: boolean;
  overlayStyle?: React.CSSProperties;
  onDragHandlePointerDown: (
    sectionId: string,
    questionId: string,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
};
