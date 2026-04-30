import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";

export const createTestSteps: CreateTestStep[] = ["Basic info", "Questions", "Review", "Publish"];

export const createId = () => uuidv4();

const getSectionTemplates = (examType: string): Array<{ type: QuestionSectionType; headerText: string }> => {
  if (examType === "essay") {
    return [{ type: "essay", headerText: "Essay Questions" }];
  }

  if (examType === "hybrid" || examType === "model") {
    return [
      { type: "objective", headerText: "Objective Questions" },
      { type: "essay", headerText: "Essay Questions" },
    ];
  }

  return [{ type: "objective", headerText: "Objective Questions" }];
};

export const createOption = (text = "", image: string | null = null): QuestionOption => ({
  id: createId(),
  text,
  image,
});

export const createQuestion = (sectionType: QuestionSectionType): QuestionItem => {
  if (sectionType === "essay") {
    return {
      id: createId(),
      text: "",
      image: null,
      points: 2,
      showValidation: false,
    };
  }

  return {
    id: createId(),
    text: "",
    image: null,
    options: [],
    correctOptionId: null,
    points: 2,
    showValidation: false,
  };
};

export const createQuestionSection = (type: QuestionSectionType, headerText: string): QuestionSectionItem => ({
  id: createId(),
  type,
  headerText,
  questions: [createQuestion(type)],
});

export const createQuestionSections = (
  examType: string,
  existingSections: QuestionSectionItem[] = [],
): QuestionSectionItem[] => {
  const existingSectionsByType = new Map(existingSections.map((section) => [section.type, section]));

  return getSectionTemplates(examType).map(({ type, headerText }) => {
    const existingSection = existingSectionsByType.get(type);

    if (existingSection) {
      return {
        ...existingSection,
        headerText,
      };
    }

    return createQuestionSection(type, headerText);
  });
};

export const createSubject = (
  examType: string,
  subjectOption: Pick<SubjectItem, "name" | "value" | "id">,
  existingSections: QuestionSectionItem[] = [],
): SubjectItem => ({
  id: subjectOption.id,
  name: subjectOption.name,
  value: subjectOption.value,
  questionSections: createQuestionSections(examType, existingSections),
});

export const moveQuestionInList = (questions: QuestionItem[], questionId: string, targetIndex: number) => {
  const currentIndex = questions.findIndex((question) => question.id === questionId);

  if (currentIndex === -1) {
    return questions;
  }

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, questions.length - 1));

  if (currentIndex === boundedTargetIndex) {
    return questions;
  }

  const nextQuestions = [...questions];
  const [movedQuestion] = nextQuestions.splice(currentIndex, 1);
  nextQuestions.splice(boundedTargetIndex, 0, movedQuestion);

  return nextQuestions;
};

export const createInitialState = (): CreateTestState => ({
  currentStep: createTestSteps[0],
  formState: {
    examType: "",
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

export const findSubjectById = (subjects: SubjectItem[], subjectId: string) =>
  subjects.find((subject) => subject.id === subjectId) ?? null;

export const findSectionById = (sections: QuestionSectionItem[], sectionId: string) =>
  sections.find((section) => section.id === sectionId) ?? null;

export const findSubjectSection = (subjects: SubjectItem[], subjectId: string, sectionId: string) => {
  const subject = findSubjectById(subjects, subjectId);
  const section = subject ? findSectionById(subject.questionSections, sectionId) : null;

  return { subject, section };
};

export const resetTransientState = (state: CreateTestState) => {
  state.activeQuestionId = null;
  state.pendingFocusQuestion = null;
  state.pendingFocusOption = null;
  state.dragState = null;
};

export const focusQuestion = (state: CreateTestState, subjectId: string, sectionId: string, questionId: string) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = questionId;
  state.pendingFocusQuestion = {
    subjectId,
    sectionId,
    questionId,
  };
  state.pendingFocusOption = null;
};

export const focusOption = (
  state: CreateTestState,
  subjectId: string,
  sectionId: string,
  questionId: string,
  optionId: string,
) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = questionId;
  state.pendingFocusOption = {
    subjectId,
    sectionId,
    questionId,
    optionId,
  };
};

export const getFirstInvalidQuestion = (section: QuestionSectionItem) =>
  section.questions.find((question) => getQuestionValidationErrors(question, section.type).length > 0) ?? null;

export const showSectionValidationErrors = (section: QuestionSectionItem) => {
  section.questions.forEach((question) => {
    question.showValidation = getQuestionValidationErrors(question, section.type).length > 0;
  });
};

export const syncSubjectsForExamType = (subjects: SubjectItem[], examType: string, activeSubjectId: string | null) => {
  const syncedSubjects = subjects.map((subject) => ({
    ...subject,
    questionSections: createQuestionSections(examType, subject.questionSections),
  }));

  if (examType === "model") {
    return syncedSubjects;
  }

  const preferredSubject =
    syncedSubjects.find((subject) => subject.id === activeSubjectId) ?? syncedSubjects[0] ?? null;

  return preferredSubject ? [preferredSubject] : [];
};
