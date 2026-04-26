import type { PayloadAction } from "@reduxjs/toolkit";
import {
  createId,
  createOption,
  createQuestion,
  findSubjectSection,
  focusOption,
  focusQuestion,
  getFirstInvalidQuestion,
  moveQuestionInList,
  showSectionValidationErrors,
} from "./createTestDomain";

type SubjectSectionPayload = {
  subjectId: string;
  sectionId: string;
};

type QuestionPayload = SubjectSectionPayload & {
  questionId: string;
};

type OptionPayload = QuestionPayload & {
  optionId: string;
};

export const createTestQuestionReducers = {
  addQuestion: (state: CreateTestState, action: PayloadAction<SubjectSectionPayload>) => {
    const { section, subject } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

    if (!section || !subject) {
      return;
    }

    const invalidQuestion = getFirstInvalidQuestion(section);

    if (invalidQuestion) {
      showSectionValidationErrors(section);
      focusQuestion(state, subject.id, section.id, invalidQuestion.id);
      return;
    }

    const nextQuestion = createQuestion(section.type);

    section.questions.push(nextQuestion);
    focusQuestion(state, subject.id, section.id, nextQuestion.id);
  },
  deleteQuestion: (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
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
  duplicateQuestion: (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
    const { section, subject } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

    if (!section || !subject) {
      return;
    }

    const target = section.questions.find((question) => question.id === action.payload.questionId);

    if (!target) {
      return;
    }

    const invalidQuestion = getFirstInvalidQuestion(section);

    if (invalidQuestion) {
      showSectionValidationErrors(section);
      focusQuestion(state, subject.id, section.id, invalidQuestion.id);
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
    focusQuestion(state, subject.id, section.id, duplicatedQuestion.id);
  },
  shuffleOptions: (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
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
    state: CreateTestState,
    action: PayloadAction<QuestionPayload & { text: string }>,
  ) => {
    const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
    const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

    if (question) {
      question.text = action.payload.text;
    }
  },
  updateQuestionImage: (
    state: CreateTestState,
    action: PayloadAction<QuestionPayload & { image: string | null }>,
  ) => {
    const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
    const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

    if (question) {
      question.image = action.payload.image;
    }
  },
  updateOptionText: (
    state: CreateTestState,
    action: PayloadAction<OptionPayload & { text: string }>,
  ) => {
    const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
    const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
    const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

    if (option) {
      option.text = action.payload.text;
    }
  },
  updateOptionImage: (
    state: CreateTestState,
    action: PayloadAction<OptionPayload & { image: string | null }>,
  ) => {
    const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
    const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
    const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

    if (option) {
      option.image = action.payload.image;
    }
  },
  selectCorrectOption: (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
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
  removeOption: (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
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
    state: CreateTestState,
    action: PayloadAction<QuestionPayload & { image?: string | null }>,
  ) => {
    const { section, subject } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

    if (!section || !subject || section.type !== "objective") {
      return;
    }

    const question = section.questions.find((entry) => entry.id === action.payload.questionId);

    if (!question) {
      return;
    }

    question.options = question.options ?? [];

    if (question.options.length >= 4) {
      return;
    }

    const nextOption = createOption(action.payload.image ? " " : "", action.payload.image ?? null);
    question.options.push(nextOption);
    focusOption(state, subject.id, section.id, question.id, nextOption.id);
  },
  updateQuestionPoints: (
    state: CreateTestState,
    action: PayloadAction<QuestionPayload & { points: number }>,
  ) => {
    const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
    const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

    if (question) {
      question.points = Math.max(0, action.payload.points || 0);
    }
  },
  setQuestionValidationState: (
    state: CreateTestState,
    action: PayloadAction<
      Array<{
        subjectId: string;
        sectionId: string;
        questionId: string;
      }>
    >,
  ) => {
    const invalidQuestions = new Set(
      action.payload.map((item) => `${item.subjectId}:${item.sectionId}:${item.questionId}`),
    );

    state.subjects.forEach((subject) => {
      subject.questionSections.forEach((section) => {
        section.questions.forEach((question) => {
          question.showValidation = invalidQuestions.has(`${subject.id}:${section.id}:${question.id}`);
        });
      });
    });

    const firstInvalidQuestion = action.payload[0];

    if (firstInvalidQuestion) {
      focusQuestion(
        state,
        firstInvalidQuestion.subjectId,
        firstInvalidQuestion.sectionId,
        firstInvalidQuestion.questionId,
      );
    }
  },
  moveQuestion: (
    state: CreateTestState,
    action: PayloadAction<QuestionPayload & { targetIndex: number }>,
  ) => {
    const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

    if (section) {
      section.questions = moveQuestionInList(section.questions, action.payload.questionId, action.payload.targetIndex);
    }
  },
  setActiveQuestionId: (state: CreateTestState, action: PayloadAction<string | null>) => {
    state.activeQuestionId = action.payload;
  },
  clearPendingFocusQuestionId: (state: CreateTestState) => {
    state.pendingFocusQuestion = null;
  },
  clearPendingFocusOption: (state: CreateTestState) => {
    state.pendingFocusOption = null;
  },
};