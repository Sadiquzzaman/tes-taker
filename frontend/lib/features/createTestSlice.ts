import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const createTestSteps: CreateTestStep[] = ["Basic info", "Questions", "Review", "Publish"];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

const createOption = (text = "", image: string | null = null): QuestionOption => ({
  id: createId(),
  text,
  image,
});

const createQuestion = (sectionType: QuestionSectionType): QuestionItem => {
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

const createQuestionSection = (type: QuestionSectionType, headerText: string): QuestionSectionItem => ({
  id: createId(),
  type,
  headerText,
  questions: [createQuestion(type)],
});

const createQuestionSections = (
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

const createSubject = (
  examType: string,
  subjectOption: Pick<SubjectItem, "name" | "value">,
  existingSections: QuestionSectionItem[] = [],
): SubjectItem => ({
  id: createId(),
  name: subjectOption.name,
  value: subjectOption.value,
  questionSections: createQuestionSections(examType, existingSections),
});

const moveQuestionInList = (questions: QuestionItem[], questionId: string, targetIndex: number) => {
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

const createInitialState = (): CreateTestState => ({
  currentStep: createTestSteps[3],
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
    scheduleDate: new Date().toLocaleString().slice(0, 10),
    scheduleTime: new Date().toLocaleString().slice(11, 16),
    endingDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleString().slice(0, 10),
    endingTime: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleString().slice(11, 16),
    testAudience: "anyone",
    selectedClassId: "",
    specificStudents: [],
  },
});

const initialState: CreateTestState = createInitialState();

const findSubjectById = (subjects: SubjectItem[], subjectId: string) =>
  subjects.find((subject) => subject.id === subjectId) ?? null;

const findSectionById = (sections: QuestionSectionItem[], sectionId: string) =>
  sections.find((section) => section.id === sectionId) ?? null;

const findSubjectSection = (subjects: SubjectItem[], subjectId: string, sectionId: string) => {
  const subject = findSubjectById(subjects, subjectId);
  const section = subject ? findSectionById(subject.questionSections, sectionId) : null;

  return { subject, section };
};

const resetTransientState = (state: CreateTestState) => {
  state.activeQuestionId = null;
  state.pendingFocusQuestion = null;
  state.pendingFocusOption = null;
  state.dragState = null;
};

const syncSubjectsForExamType = (subjects: SubjectItem[], examType: string, activeSubjectId: string | null) => {
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

export const createTestSlice = createSlice({
  name: "createTestSlice",
  initialState,
  reducers: {
    resetForm: () => createInitialState(),
    goToNextStep: (state) => {
      const currentIndex = createTestSteps.indexOf(state.currentStep);

      if (currentIndex < createTestSteps.length - 1) {
        state.currentStep = createTestSteps[currentIndex + 1];
      }
    },
    goToPreviousStep: (state) => {
      const currentIndex = createTestSteps.indexOf(state.currentStep);

      if (currentIndex > 0) {
        state.currentStep = createTestSteps[currentIndex - 1];
      }
    },
    setFormField: (state, action: PayloadAction<{ field: keyof FormState; value: FormState[keyof FormState] }>) => {
      state.formState[action.payload.field] = action.payload.value as never;

      if (action.payload.field === "examType") {
        const nextExamType = String(action.payload.value);

        state.subjects = syncSubjectsForExamType(state.subjects, nextExamType, state.activeSubjectId);
        state.activeSubjectId = state.subjects[0]?.id ?? null;
        resetTransientState(state);
      }
    },
    setSingleSubject: (state, action: PayloadAction<{ label: string; value: string }>) => {
      const existingSubject = state.subjects.find((subject) => subject.value === action.payload.value) ?? null;
      const nextSubject = existingSubject
        ? {
            ...existingSubject,
            name: action.payload.label,
            value: action.payload.value,
            questionSections: createQuestionSections(state.formState.examType, existingSubject.questionSections),
          }
        : createSubject(state.formState.examType, { name: action.payload.label, value: action.payload.value });

      state.subjects = [nextSubject];
      state.activeSubjectId = nextSubject.id;
      resetTransientState(state);
    },
    addSubject: (state, action: PayloadAction<{ label: string; value: string }>) => {
      const existingSubject = state.subjects.find((subject) => subject.value === action.payload.value);

      if (existingSubject) {
        state.activeSubjectId = existingSubject.id;
        resetTransientState(state);
        return;
      }

      const nextSubject = createSubject(state.formState.examType, {
        name: action.payload.label,
        value: action.payload.value,
      });

      state.subjects.push(nextSubject);
      state.activeSubjectId = nextSubject.id;
      resetTransientState(state);
    },
    setActiveSubjectId: (state, action: PayloadAction<string | null>) => {
      state.activeSubjectId = action.payload;
      resetTransientState(state);
    },
    addQuestion: (state, action: PayloadAction<{ subjectId: string; sectionId: string }>) => {
      const { section, subject } = findSubjectSection(
        state.subjects,
        action.payload.subjectId,
        action.payload.sectionId,
      );

      if (!section || !subject) {
        return;
      }

      if (section.type === "objective") {
        const invalidQuestion = section.questions.find((question) => !question.correctOptionId);

        if (invalidQuestion) {
          section.questions.forEach((question) => {
            if (!question.correctOptionId) {
              question.showValidation = true;
            }
          });

          state.activeSubjectId = subject.id;
          state.activeQuestionId = invalidQuestion.id;
          state.pendingFocusQuestion = {
            subjectId: subject.id,
            sectionId: section.id,
            questionId: invalidQuestion.id,
          };
          state.pendingFocusOption = null;
          return;
        }
      }

      const nextQuestion = createQuestion(section.type);

      section.questions.push(nextQuestion);
      state.activeSubjectId = subject.id;
      state.activeQuestionId = nextQuestion.id;
      state.pendingFocusQuestion = {
        subjectId: subject.id,
        sectionId: section.id,
        questionId: nextQuestion.id,
      };
      state.pendingFocusOption = null;
    },
    deleteQuestion: (state, action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string }>) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

      if (!section) {
        return;
      }

      section.questions = section.questions.filter((question) => question.id !== action.payload.questionId);

      if (state.activeQuestionId === action.payload.questionId) {
        state.activeQuestionId = section.questions[section.questions.length - 1]?.id ?? null;
      }

      if (
        state.pendingFocusQuestion?.subjectId === action.payload.subjectId &&
        state.pendingFocusQuestion.questionId === action.payload.questionId
      ) {
        state.pendingFocusQuestion = null;
      }

      if (
        state.pendingFocusOption?.subjectId === action.payload.subjectId &&
        state.pendingFocusOption.questionId === action.payload.questionId
      ) {
        state.pendingFocusOption = null;
      }

      if (state.dragState?.id === action.payload.questionId && state.dragState.subjectId === action.payload.subjectId) {
        state.dragState = null;
      }
    },
    duplicateQuestion: (state, action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string }>) => {
      const { section, subject } = findSubjectSection(
        state.subjects,
        action.payload.subjectId,
        action.payload.sectionId,
      );

      if (!section || !subject) {
        return;
      }

      const target = section.questions.find((question) => question.id === action.payload.questionId);

      if (!target) {
        return;
      }

      if (section.type === "objective") {
        const invalidQuestion = section.questions.find((question) => !question.correctOptionId);

        if (invalidQuestion) {
          section.questions.forEach((question) => {
            if (!question.correctOptionId) {
              question.showValidation = true;
            }
          });

          state.activeSubjectId = subject.id;
          state.activeQuestionId = invalidQuestion.id;
          state.pendingFocusQuestion = {
            subjectId: subject.id,
            sectionId: section.id,
            questionId: invalidQuestion.id,
          };
          state.pendingFocusOption = null;
          return;
        }
      }

      const optionIdMap = new Map<string, string>();
      const clonedOptions = (target.options ?? []).map((option) => {
        const newId = createId();
        optionIdMap.set(option.id, newId);

        return {
          ...option,
          id: newId,
        };
      });

      const duplicatedQuestion: QuestionItem = {
        ...target,
        id: createId(),
        ...(section.type === "objective"
          ? {
              options: clonedOptions,
              correctOptionId: target.correctOptionId ? optionIdMap.get(target.correctOptionId) || null : null,
            }
          : { options: undefined, correctOptionId: undefined }),
        showValidation: false,
      };

      const index = section.questions.findIndex((question) => question.id === action.payload.questionId);
      section.questions.splice(index + 1, 0, duplicatedQuestion);
      state.activeSubjectId = subject.id;
      state.activeQuestionId = duplicatedQuestion.id;
      state.pendingFocusQuestion = {
        subjectId: subject.id,
        sectionId: section.id,
        questionId: duplicatedQuestion.id,
      };
      state.pendingFocusOption = null;
    },
    shuffleOptions: (state, action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string }>) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

      if (!section || section.type !== "objective") {
        return;
      }

      const question = section.questions.find((entry) => entry.id === action.payload.questionId);

      if (!question?.options) {
        return;
      }

      for (let index = question.options.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [question.options[index], question.options[swapIndex]] = [question.options[swapIndex], question.options[index]];
      }
    },
    updateQuestionText: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; text: string }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.text = action.payload.text;
      }
    },
    updateQuestionImage: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; image: string | null }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.image = action.payload.image;
      }
    },
    updateOptionText: (
      state,
      action: PayloadAction<{
        subjectId: string;
        sectionId: string;
        questionId: string;
        optionId: string;
        text: string;
      }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
      const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

      if (option) {
        option.text = action.payload.text;
      }
    },
    updateOptionImage: (
      state,
      action: PayloadAction<{
        subjectId: string;
        sectionId: string;
        questionId: string;
        optionId: string;
        image: string | null;
      }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
      const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

      if (option) {
        option.image = action.payload.image;
      }
    },
    selectCorrectOption: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; optionId: string }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

      if (!section || section.type !== "objective") {
        return;
      }

      const question = section.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.correctOptionId = action.payload.optionId;
        question.showValidation = false;
      }
    },
    removeOption: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; optionId: string }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

      if (!section || section.type !== "objective") {
        return;
      }

      const question = section.questions.find((entry) => entry.id === action.payload.questionId);

      if (!question?.options) {
        return;
      }

      question.options = question.options.filter((entry) => entry.id !== action.payload.optionId);

      if (question.correctOptionId === action.payload.optionId) {
        question.correctOptionId = null;
      }

      if (
        state.pendingFocusOption?.subjectId === action.payload.subjectId &&
        state.pendingFocusOption?.sectionId === action.payload.sectionId &&
        state.pendingFocusOption.questionId === action.payload.questionId &&
        state.pendingFocusOption.optionId === action.payload.optionId
      ) {
        state.pendingFocusOption = null;
      }
    },
    addOption: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; image?: string | null }>,
    ) => {
      const { section, subject } = findSubjectSection(
        state.subjects,
        action.payload.subjectId,
        action.payload.sectionId,
      );

      if (!section || !subject || section.type !== "objective") {
        return;
      }

      const question = section.questions.find((entry) => entry.id === action.payload.questionId);

      if (!question) {
        return;
      }

      const nextOption = createOption(action.payload.image ? " " : "", action.payload.image ?? null);
      question.options = question.options ?? [];
      question.options.push(nextOption);
      state.activeSubjectId = subject.id;
      state.activeQuestionId = question.id;
      state.pendingFocusOption = {
        subjectId: subject.id,
        sectionId: section.id,
        questionId: question.id,
        optionId: nextOption.id,
      };
    },
    updateQuestionPoints: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; points: number }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.points = Math.max(0, action.payload.points || 0);
      }
    },
    moveQuestion: (
      state,
      action: PayloadAction<{ subjectId: string; sectionId: string; questionId: string; targetIndex: number }>,
    ) => {
      const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

      if (section) {
        section.questions = moveQuestionInList(
          section.questions,
          action.payload.questionId,
          action.payload.targetIndex,
        );
      }
    },
    setActiveQuestionId: (state, action: PayloadAction<string | null>) => {
      state.activeQuestionId = action.payload;
    },
    clearPendingFocusQuestionId: (state) => {
      state.pendingFocusQuestion = null;
    },
    clearPendingFocusOption: (state) => {
      state.pendingFocusOption = null;
    },
    startDragging: (state, action: PayloadAction<DragState>) => {
      state.dragState = action.payload;
      state.activeSubjectId = action.payload.subjectId;
      state.activeQuestionId = action.payload.id;
    },
    updateDragging: (state, action: PayloadAction<Pick<DragState, "pointerX" | "pointerY" | "dropLineIndex">>) => {
      if (!state.dragState) {
        return;
      }

      state.dragState.pointerX = action.payload.pointerX;
      state.dragState.pointerY = action.payload.pointerY;
      state.dragState.dropLineIndex = action.payload.dropLineIndex;
    },
    finishDragging: (state) => {
      if (!state.dragState) {
        return;
      }

      const { id, subjectId, sectionId, draggedOriginalIndex, dropLineIndex } = state.dragState;
      const { section } = findSubjectSection(state.subjects, subjectId, sectionId);

      if (!section) {
        state.dragState = null;
        return;
      }

      if (dropLineIndex !== draggedOriginalIndex && dropLineIndex !== draggedOriginalIndex + 1) {
        const targetIndex = dropLineIndex > draggedOriginalIndex ? dropLineIndex - 1 : dropLineIndex;
        section.questions = moveQuestionInList(section.questions, id, targetIndex);
      }

      state.dragState = null;
    },
    cancelDragging: (state) => {
      state.dragState = null;
    },
    setPublishTiming: (state, action: PayloadAction<PublishTiming>) => {
      state.publishState.publishTiming = action.payload;
    },
    setPublishField: (
      state,
      action: PayloadAction<{
        field: keyof Omit<PublishState, "publishTiming" | "testAudience" | "specificStudents">;
        value: string;
      }>,
    ) => {
      (state.publishState[action.payload.field] as string) = action.payload.value;
    },
    setTestAudience: (state, action: PayloadAction<TestAudience>) => {
      state.publishState.testAudience = action.payload;
    },
    addSpecificStudent: (state, action: PayloadAction<string>) => {
      const trimmed = action.payload.trim();
      if (trimmed && !state.publishState.specificStudents.includes(trimmed)) {
        state.publishState.specificStudents.push(trimmed);
      }
    },
    removeSpecificStudent: (state, action: PayloadAction<number>) => {
      state.publishState.specificStudents.splice(action.payload, 1);
    },
  },
});

export const {
  resetForm,
  addOption,
  addQuestion,
  addSubject,
  cancelDragging,
  clearPendingFocusOption,
  clearPendingFocusQuestionId,
  deleteQuestion,
  duplicateQuestion,
  finishDragging,
  goToNextStep,
  goToPreviousStep,
  moveQuestion,
  removeOption,
  selectCorrectOption,
  setActiveQuestionId,
  setActiveSubjectId,
  setFormField,
  setSingleSubject,
  shuffleOptions,
  startDragging,
  updateOptionImage,
  updateDragging,
  updateOptionText,
  updateQuestionImage,
  updateQuestionPoints,
  updateQuestionText,
  setPublishTiming,
  setPublishField,
  setTestAudience,
  addSpecificStudent,
  removeSpecificStudent,
} = createTestSlice.actions;

export default createTestSlice.reducer;
