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

type MatchingOptionSide = "left" | "right";

type MatchingQuestionOptions = {
  left: QuestionOption[];
  right: QuestionOption[];
};

type QuestionAnswerType = "text" | "optionId" | "matchingOrdering";

type QuestionAnswer = {
  type: QuestionAnswerType;
  value: string[];
};

type LegacyQuestionItem = QuestionItem & {
  correctOptionId?: string | null;
  correctOptionIds?: string[];
  correctAns?: string;
  alternativeAnser?: string[];
};

type CreateTestQuestionCategory = "graded" | "ungraded" | "other";

type CreateTestQuestionAnswerMode = "single" | "multiple" | "none";

type CreateTestQuestionAnswerInputMode = "none" | "correct-answer";

type CreateTestQuestionFixedOptionTemplate = {
  image: string | null;
  text: string;
};

type CreateTestQuestionOptionRules = {
  canAddOptions: boolean;
  canEditOptionImage: boolean;
  canEditOptionText: boolean;
  canRemoveOptions: boolean;
  canShuffleOptions: boolean;
  fixedOptions: CreateTestQuestionFixedOptionTemplate[];
  maxOptions: number;
  minOptions: number;
  useFixedOptions: boolean;
};

type CreateTestQuestionSubtypeOption = {
  answerMode: CreateTestQuestionAnswerMode;
  answerInputMode: CreateTestQuestionAnswerInputMode;
  answerInputPlaceholder?: string;
  supportsAlternativeAnswers?: boolean;
  id: string;
  label: string;
  optionRules: CreateTestQuestionOptionRules | null;
  isSupported: boolean;
  headerPayload: string;
};

type CreateTestQuestionCategoryOption = {
  id: CreateTestQuestionCategory;
  label: string;
  tabs: CreateTestQuestionSubtypeOption[];
};

type QuestionItem = {
  id: string;
  type: CreateTestQuestionCategory;
  subType: string;
  text: string;
  instruction: string;
  image: string | null;
  matchingOptions?: MatchingQuestionOptions;
  options?: QuestionOption[];
  answer?: QuestionAnswer;
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

type SubjectSelectionPayload = {
  label: string;
  value: string;
  id: string;
};

type SubjectQuestionTypePayload = {
  subjectId: string;
  questionType: CreateTestQuestionCategory;
  subType: string;
};

type QuestionPayload = {
  subjectId: string;
  questionId: string;
};

type QuestionAnswerValuePayload = QuestionPayload & {
  index: number;
  value: string;
};

type OptionPayload = QuestionPayload & {
  optionId: string;
};

type MatchingPairPayload = QuestionPayload & {
  pairIndex: number;
};

type MatchingOptionTextPayload = QuestionPayload & {
  optionId: string;
  side: MatchingOptionSide;
  text: string;
};

type SetFormFieldPayload = {
  field: keyof FormState;
  value: FormState[keyof FormState];
};

type InvalidQuestionPayload = {
  subjectId: string;
  questionId: string;
};

type SetPublishFieldPayload = {
  field: keyof Omit<PublishState, "publishTiming" | "testAudience" | "excluded_students">;
  value: string;
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

type CreateModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
};

type AddSubjectModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (subject: SubjectSelectionPayload) => void;
};

type AddQuestionSubjectModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (subject: SubjectSelectionPayload) => void;
  subjectOptions: SubjectSelectionPayload[];
};

type CreateTestFooterProps = {
  currentStep: CreateTestStep;
  isFirstStep: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void | Promise<void>;
};

type CreateTestStepContentProps = {
  currentStep: CreateTestStep;
  formState: FormState;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
};

type CreateTestStepSidebarProps = {
  currentStep: CreateTestStep;
};

type QuestionSubjectTabsProps = {
  subjects: SubjectItem[];
  activeSubjectId: string | null;
  availableSubjectOptions: SubjectSelectionPayload[];
  onSelectSubject: (subjectId: string) => void;
  onAddSubject: (subject: SubjectSelectionPayload) => void;
  onRemoveSubject: (subjectId: string) => void;
};

type RemoveSubjectConfirmationModalProps = {
  open: boolean;
  subjectName: string;
  onClose: () => void;
  onConfirm: () => void;
};

type ScrollElementIntoView = (element: HTMLElement | null, behavior?: ScrollBehavior) => void;

type ValidateImageFile = (file: File) => boolean;

type QuestionCardHeaderProps = {
  activateCard: () => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
  questionId: string;
  questionImage: string | null;
  questionNumber: number;
  questionText: string;
  scrollElementIntoView: ScrollElementIntoView;
  shouldAutoFocus: boolean;
  subjectId: string;
  validateImageFile: ValidateImageFile;
  fullSubtype: CreateTestQuestionSubtypeOption;
};

type QuestionCardBodyProps = {
  activateCard: () => void;
  canAddMoreOptions: boolean;
  canAddOptions: boolean;
  canEditOptionImage: boolean;
  canEditOptionText: boolean;
  canRemoveOptions: boolean;
  maxOptions: number;
  options: QuestionOption[];
  pendingFocusOptionId: string | null;
  questionId: string;
  questionNumber: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollElementIntoView: ScrollElementIntoView;
  selectedOptionIds: string[];
  subjectId: string;
  usesMultipleAnswers: boolean;
  validateImageFile: ValidateImageFile;
};

type QuestionCardMatchingBodyProps = {
  activateCard: () => void;
  canAddMorePairs: boolean;
  leftOptions: QuestionOption[];
  maxPairs: number;
  pendingFocusOptionId: string | null;
  questionId: string;
  rightOptions: QuestionOption[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollElementIntoView: ScrollElementIntoView;
  subjectId: string;
};

type QuestionCardFooterProps = {
  canShuffleOptions: boolean;
  points: number;
  questionSubType: string;
  questionId: string;
  questionType: CreateTestQuestionCategory;
  subjectId: string;
};

type QuestionCardInstructionProps = {
  instruction: string;
  questionId: string;
  subjectId: string;
};

type QuestionCardTextAnswerProps = {
  answerValues: string[];
  activateCard: () => void;
  placeholder: string;
  questionId: string;
  showAlternativeAnswerInput: boolean;
  subjectId: string;
};

type QuestionCardValidationProps = {
  showValidation: boolean;
  validationErrors: string[];
};

type QuestionValidationFailure = {
  subjectId: string;
  questionId: string;
  errors: string[];
};

type LegacyCreateTestSubmissionQuestionAnswer = {
  correctOptionId?: string | null;
  correctOptionIds?: string[];
  correctAns?: string;
  alternativeAnser?: string[];
};

type CreateTestSubmissionQuestionItem = Omit<QuestionItem, "type" | "answer"> &
  LegacyCreateTestSubmissionQuestionAnswer & {
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
