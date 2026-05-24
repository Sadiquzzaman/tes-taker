import dayjs from "dayjs";
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
  pendingFocusQuestion: null,
  pendingFocusOption: null,
  dragState: null,
  publishState: {
    publishTiming: "immediately",
    scheduleAt: dayjs().add(3, "hour").toISOString(),
    endingAt: dayjs().add(3, "day").toISOString(),
    testAudience: "anyone",
    selectedClassId: "",
    excluded_students: [],
  },
});

export default createInitialState;
