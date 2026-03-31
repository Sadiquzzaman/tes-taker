import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const createTestSteps: CreateTestStep[] = ["Basic info", "Questions", "Review", "Publish"];

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getSectionTemplates = (examType: string): Array<{ type: QuestionSectionType; headerText: string }> => {
  if (examType === "essay") {
    return [{ type: "essay", headerText: "Essay Questions" }];
  }

  if (examType === "mock") {
    return [
      { type: "objective", headerText: "Objective Questions" },
      { type: "essay", headerText: "Essay Questions" },
    ];
  }

  return [{ type: "objective", headerText: "Objective Questions" }];
};

const createOption = (text = ""): QuestionOption => ({
  id: createId(),
  text,
});

const createQuestion = (sectionType: QuestionSectionType): QuestionItem => {
  if (sectionType === "essay") {
    return {
      id: createId(),
      text: "",
      points: 2,
      showValidation: false,
    };
  }

  return {
    id: createId(),
    text: "",
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
  currentStep: createTestSteps[0],
  formState: {
    examType: "",
    testName: "",
    subject: "",
    duration: "",
    passingScore: "",
    allowNegativeMarking: false,
    negativeMarking: "",
  },
  questionSections: [],
  activeQuestionId: null,
  pendingFocusQuestion: null,
  pendingFocusOption: null,
  dragState: null,
});

const initialState: CreateTestState = createInitialState();

const findSectionById = (sections: QuestionSectionItem[], sectionId: string) =>
  sections.find((section) => section.id === sectionId) ?? null;

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

        state.questionSections = createQuestionSections(nextExamType, state.questionSections);
        state.activeQuestionId = null;
        state.pendingFocusQuestion = null;
        state.pendingFocusOption = null;
        state.dragState = null;
      }
    },
    addQuestion: (state, action: PayloadAction<string>) => {
      const section = findSectionById(state.questionSections, action.payload);

      if (!section) {
        return;
      }

      const nextQuestion = createQuestion(section.type);

      section.questions.push(nextQuestion);
      state.activeQuestionId = nextQuestion.id;
      state.pendingFocusQuestion = {
        sectionId: section.id,
        questionId: nextQuestion.id,
      };
      state.pendingFocusOption = null;
    },
    deleteQuestion: (state, action: PayloadAction<{ sectionId: string; questionId: string }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

      if (!section) {
        return;
      }

      section.questions = section.questions.filter((question) => question.id !== action.payload.questionId);

      if (state.activeQuestionId === action.payload.questionId) {
        state.activeQuestionId = section.questions[section.questions.length - 1]?.id ?? null;
      }

      if (state.pendingFocusQuestion?.questionId === action.payload.questionId) {
        state.pendingFocusQuestion = null;
      }

      if (state.pendingFocusOption?.questionId === action.payload.questionId) {
        state.pendingFocusOption = null;
      }

      if (state.dragState?.id === action.payload.questionId) {
        state.dragState = null;
      }
    },
    duplicateQuestion: (state, action: PayloadAction<{ sectionId: string; questionId: string }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

      if (!section) {
        return;
      }

      const target = section.questions.find((question) => question.id === action.payload.questionId);

      if (!target) {
        return;
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
      state.activeQuestionId = duplicatedQuestion.id;
      state.pendingFocusQuestion = {
        sectionId: section.id,
        questionId: duplicatedQuestion.id,
      };
      state.pendingFocusOption = null;
    },
    shuffleOptions: (state, action: PayloadAction<{ sectionId: string; questionId: string }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

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
    updateQuestionText: (state, action: PayloadAction<{ sectionId: string; questionId: string; text: string }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.text = action.payload.text;
      }
    },
    updateOptionText: (
      state,
      action: PayloadAction<{ sectionId: string; questionId: string; optionId: string; text: string }>,
    ) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
      const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

      if (option) {
        option.text = action.payload.text;
      }
    },
    selectCorrectOption: (
      state,
      action: PayloadAction<{ sectionId: string; questionId: string; optionId: string }>,
    ) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

      if (!section || section.type !== "objective") {
        return;
      }

      const question = section.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.correctOptionId = action.payload.optionId;
        question.showValidation = false;
      }
    },
    removeOption: (state, action: PayloadAction<{ sectionId: string; questionId: string; optionId: string }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

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
        state.pendingFocusOption?.sectionId === action.payload.sectionId &&
        state.pendingFocusOption?.questionId === action.payload.questionId &&
        state.pendingFocusOption.optionId === action.payload.optionId
      ) {
        state.pendingFocusOption = null;
      }
    },
    addOption: (state, action: PayloadAction<{ sectionId: string; questionId: string }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

      if (!section || section.type !== "objective") {
        return;
      }

      const question = section.questions.find((entry) => entry.id === action.payload.questionId);

      if (!question) {
        return;
      }

      const nextOption = createOption();
      question.options = question.options ?? [];
      question.options.push(nextOption);
      state.activeQuestionId = question.id;
      state.pendingFocusOption = {
        sectionId: section.id,
        questionId: question.id,
        optionId: nextOption.id,
      };
    },
    updateQuestionPoints: (state, action: PayloadAction<{ sectionId: string; questionId: string; points: number }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);
      const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

      if (question) {
        question.points = Math.max(1, action.payload.points || 1);
      }
    },
    moveQuestion: (state, action: PayloadAction<{ sectionId: string; questionId: string; targetIndex: number }>) => {
      const section = findSectionById(state.questionSections, action.payload.sectionId);

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

      const { id, draggedOriginalIndex, dropLineIndex } = state.dragState;
      const section = findSectionById(state.questionSections, state.dragState.sectionId);

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
  },
});

export const {
  resetForm,
  addOption,
  addQuestion,
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
  setFormField,
  shuffleOptions,
  startDragging,
  updateDragging,
  updateOptionText,
  updateQuestionPoints,
  updateQuestionText,
} = createTestSlice.actions;

export default createTestSlice.reducer;
