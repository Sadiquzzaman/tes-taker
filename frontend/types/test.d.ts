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
}

interface SetExamAnswerValuePayload {
  questionId: string;
  value: ExamAnswerValue;
}
