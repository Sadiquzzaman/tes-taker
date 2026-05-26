type NewTestShareData = {
  type?: "new" | "existing";
  test: ITest;
};

type ShareTestModalProps = {
  open: boolean;
  setOpen: () => void;
  testData: NewTestShareData;
};

interface ExamCountdownProps {
  durationMinutes?: number;
  submitButtonRef: React.RefObject<HTMLButtonElement | null>;
  onTimeUp?: () => void;
}

interface TestSliceState {
  activeTab: Tab;
  searchInput: string;
  newTestCreated: NewTestShareData | null;
}
