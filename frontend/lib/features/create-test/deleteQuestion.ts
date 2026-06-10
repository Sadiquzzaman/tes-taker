import type { PayloadAction } from "@reduxjs/toolkit";
import { findPassageById, findSubjectById, syncSubjectType } from "./createTestDomain";

const deleteQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const subject = findSubjectById(state.subjects, action.payload.subjectId);

  if (!subject) {
    return;
  }

  if (action.payload.parentPassageId) {
    const parentPassage = findPassageById(subject.questions, action.payload.parentPassageId);

    if (!parentPassage) {
      return;
    }

    parentPassage.childQuestions = parentPassage.childQuestions.filter(
      (question) => question.id !== action.payload.questionId,
    );
  } else {
    subject.questions = subject.questions.filter((question) => question.id !== action.payload.questionId);
  }

  syncSubjectType(subject);

  if (state.activeQuestionId === action.payload.questionId) {
    if (action.payload.parentPassageId) {
      state.activeQuestionId = null;
      state.activePassageId = action.payload.parentPassageId;
    } else {
      state.activeQuestionId = null;
      state.activePassageId = null;
    }
  }

  if (!action.payload.parentPassageId && state.activePassageId === action.payload.questionId) {
    state.activePassageId = null;
    state.activeQuestionId = null;
  }

  if (
    state.pendingFocusQuestion?.subjectId === action.payload.subjectId &&
    ((state.pendingFocusQuestion.questionId === action.payload.questionId &&
      state.pendingFocusQuestion.parentPassageId === (action.payload.parentPassageId ?? null)) ||
      (!action.payload.parentPassageId &&
        state.pendingFocusQuestion.parentPassageId === action.payload.questionId &&
        state.pendingFocusQuestion.questionId === null))
  ) {
    state.pendingFocusQuestion = null;
  }

  if (
    state.pendingFocusOption?.subjectId === action.payload.subjectId &&
    ((state.pendingFocusOption.questionId === action.payload.questionId &&
      state.pendingFocusOption.parentPassageId === (action.payload.parentPassageId ?? null)) ||
      (!action.payload.parentPassageId && state.pendingFocusOption.parentPassageId === action.payload.questionId))
  ) {
    state.pendingFocusOption = null;
  }

  if (state.dragState?.id === action.payload.questionId && state.dragState.subjectId === action.payload.subjectId) {
    state.dragState = null;
  }
};

export default deleteQuestion;
