import createTestSteps from "./createTestSteps";

const createInitialState = (): CreateTestState => ({
  currentStep: createTestSteps[0],
  formState: {
    testName: "",
    duration: "",
    passingScore: "",
    allowNegativeMarking: false,
    negativeMarking: "",
  },
  subjects: [],
  activeSubjectId: null,
  activeQuestionId: null,
  activePassageId: null,
  pendingFocusQuestion: null,
  pendingFocusOption: null,
  dragState: null,
  publishState: {
    publishTiming: "immediately",
    scheduleAt: "",
    endingAt: "",
    testAudience: "anyone",
    selectedClassId: "",
    excluded_students: [],
  },
});

export default createInitialState;
