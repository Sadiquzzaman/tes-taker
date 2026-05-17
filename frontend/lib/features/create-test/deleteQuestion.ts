import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const deleteQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
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
};

export default deleteQuestion;