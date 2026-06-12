import dayjs from "dayjs";
import createTestSteps from "./createTestSteps";

const createInitialPublishState = (): PublishState => ({
  publishTiming: "immediately",
  scheduleAt: dayjs().toISOString(),
  endingAt: dayjs().add(3, "day").toISOString(),
  testAudience: "anyone",
  selectedClassId: "",
  excluded_students: [],
});

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
  publishState: createInitialPublishState(),
});

export default createInitialState;
