type GradingModalInputMode = "single-select" | "multi-select" | "matching" | "text";

interface GradingModalOption {
  id: string;
  text: string;
  imageUrl: string | null;
}

interface GradingModalMatchingOption {
  id: string;
  text: string;
  imageUrl: string | null;
}

interface GradingModalQuestion {
  id: string;
  type: SubmissionGradingQuestionType;
  subType: SubmissionGradingQuestionSubType;
  questionNumber: number;
  question: string;
  instruction: string;
  imageUrl: string | null;
  points: number;
  marksObtained: number;
  isCorrect: boolean | null;
  inputMode: GradingModalInputMode;
  options: GradingModalOption[];
  matchingOptions?: {
    left: GradingModalMatchingOption[];
    right: GradingModalMatchingOption[];
  };
  correctAnswerValues: string[];
  selectedAnswerValues: string[];
  textAnswer: string;
  isEditable: boolean;
  isPassageChild: boolean;
}

interface GradingModalQuestionItem {
  kind: "question";
  id: string;
  question: GradingModalQuestion;
}

interface GradingModalPassageItem {
  kind: "passage";
  id: string;
  passageText: string;
  questions: GradingModalQuestion[];
}

type GradingModalItem = GradingModalQuestionItem | GradingModalPassageItem;

interface GradingModalSubmission {
  submissionId: string;
  examId: string;
  studentId: string;
  studentName: string | null;
  email: string | null;
  phone: string | null;
  submittedAt: string | null;
  status: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  isGraded: boolean;
  gradingStatus: SubmissionGradingStatus;
}

interface GradingModalTotals {
  manualTotalCount: number;
  manualGradedCount: number;
  autoTotalCount: number;
  autoGradedCount: number;
}

interface GradingModalData {
  submission: GradingModalSubmission;
  totals: GradingModalTotals;
  items: GradingModalItem[];
  questionCount: number;
}

interface GradingQuestionDraft {
  score: string;
  explanation: string;
}

type GradingQuestionDraftMap = Record<string, GradingQuestionDraft>;

interface GradingModalQuestionCardProps {
  question: GradingModalQuestion;
  draft?: GradingQuestionDraft;
  isReadOnly: boolean;
  onExplanationChange?: (questionId: string, explanation: string) => void;
  onScoreBlur?: (questionId: string, maxScore: number, currentScore: number) => void;
  onScoreChange?: (questionId: string, score: string) => void;
}

interface GradingModalQuestionListProps {
  items: GradingModalItem[];
  drafts: GradingQuestionDraftMap;
  isReadOnly: boolean;
  onExplanationChange?: (questionId: string, explanation: string) => void;
  onScoreBlur?: (questionId: string, maxScore: number, currentScore: number) => void;
  onScoreChange?: (questionId: string, score: string) => void;
}

interface GradingModalEditViewProps {
  data: GradingModalData;
  drafts: GradingQuestionDraftMap;
  onExplanationChange: (questionId: string, explanation: string) => void;
  onScoreBlur: (questionId: string, maxScore: number, currentScore: number) => void;
  onScoreChange: (questionId: string, score: string) => void;
}

interface GradingModalResultViewProps {
  data: GradingModalData;
}

interface GradingModalGradedQuestionCardProps {
  question: GradingModalQuestion;
}

interface GradingModalUngradedQuestionCardProps extends GradingModalQuestionCardProps {
  draft?: GradingQuestionDraft;
  isReadOnly: boolean;
  onExplanationChange?: (questionId: string, explanation: string) => void;
  onScoreBlur?: (questionId: string, maxScore: number, currentScore: number) => void;
  onScoreChange?: (questionId: string, score: string) => void;
}

interface GradingModalAnswerViewProps {
  question: GradingModalQuestion;
}

interface CheckedRadioBoxProps {
  border: string;
  bg: string;
  isTick?: boolean;
  rounded?: "full" | "[4px]";
}

interface OptionMarkerProps {
  isCorrect: boolean;
  isSelected: boolean;
  question: GradingModalQuestion;
}
