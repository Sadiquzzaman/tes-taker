type NewTestShareData = {
  type?: "new" | "existing";
  test: TeacherShareableTest;
};

type ShareTestModalProps = {
  open: boolean;
  setOpen: () => void;
  testData: NewTestShareData;
};

interface ExamCountdownProps {
  durationMinutes?: number;
  remainingSeconds?: number | null;
  submitButtonRef: React.RefObject<HTMLButtonElement | null>;
  onStart?: () => void;
  onTimeUp?: () => void;
}

interface TestSliceState {
  activeTab: Tab;
  searchInput: string;
  newTestCreated: NewTestShareData | null;
}

interface InitializeExamAnswersPayload {
  examId: string;
  values: ExamAnswerState;
  savedValues?: ExamAnswerState;
}

interface SetExamAnswerValuePayload {
  questionId: string;
  value: ExamAnswerValue;
}
