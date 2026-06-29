type GradeCardStatus = "Graded" | "GradedTests" | "NeedsGrading" | "Published";

type GradingModalView = "" | "edit" | "result";

interface GradingOption {
  id: string;
  text: string;
  image: string | null;
}

interface GradingEssayQuestion {
  id: string;
  text: string;
  image: string | null;
  points: number;
  showValidation: boolean;
}

interface GradingObjectiveQuestion extends GradingEssayQuestion {
  options: GradingOption[];
  correctOptionId: string;
  studentSelectedOptionId?: string;
}

type GradingQuestion = GradingEssayQuestion | GradingObjectiveQuestion;

type GradingQuestionType = "essay" | "objective";

interface GradingEssayQuestionSection {
  id: string;
  type: "essay";
  headerText: string;
  questions: GradingEssayQuestion[];
}

interface GradingObjectiveQuestionSection {
  id: string;
  type: "objective";
  headerText: string;
  questions: GradingObjectiveQuestion[];
}

type GradingQuestionSection = GradingEssayQuestionSection | GradingObjectiveQuestionSection;

type GradingQuestionWithType =
  | (GradingEssayQuestion & { type: "essay" })
  | (GradingObjectiveQuestion & { type: "objective" });

interface GradingSubject {
  id: string;
  name: string;
  value: string;
  questionSections: GradingQuestionSection[];
}

interface GradingTemplateFormState {
  testName: string;
  duration: string;
  passingScore: string;
  allowNegativeMarking: boolean;
  negativeMarking: string;
}

interface GradingPublishState {
  publishTiming: string;
  scheduleAt: string;
  endingAt: string;
  testAudience: string;
  selectedClassId: string;
  excluded_students: string[];
}

interface GradingTemplate {
  currentStep: string;
  formState: GradingTemplateFormState;
  subjects: GradingSubject[];
  activeSubjectId: string;
  activeQuestionId: string;
  pendingFocusQuestion: string | null;
  pendingFocusOption: string | null;
  dragState: string | null;
  publishState: GradingPublishState;
}

interface EssayGradeTemplateProps {
  number: number;
  question: string;
  answer: string;
  score: number;
  maxMarks: number;
  explanation?: string;
  onExplanationChange?: (value: string) => void;
}

interface ObjectiveGradeTemplateProps {
  number: number;
  question: string;
  options: GradingOption[];
  answer: string;
  score: number;
  maxMarks: number;
  correctOptionId: string;
  explanation?: string;
  onExplanationChange?: (value: string) => void;
}

type GradingQuestionInputData = Record<string, { explanation: string }>;

type GradingQuestionGroup = {
  name: string;
  questionList: GradingQuestionWithType[];
};

interface GradingResultViewProps {
  allQuestion: GradingQuestionGroup[];
}

interface GradingEditViewProps {
  handleExplanationChange: (questionId: string, explanation: string) => void;
  questionInputData: GradingQuestionInputData;
}

interface GradeCardProps {
  gradeItem: GradingListItem;
}

interface GradingSliceState {
  activeTab: Tab;
  page: number;
  searchInput: string;
}

interface GradeDetailsSliceState {
  openModal: GradingModalView;
  searchStudentInput: string;
  currentPage: number;
  totalPages: number;
  exam: GradingExamSummary | null;
  stats: GradingExamStats | null;
  submissions: GradingSubmissionListItem[];
  meta: GradingPaginationMeta | null;
  selectedSubmission: GradingSubmissionListItem | null;
}
