import type { PayloadAction } from "@reduxjs/toolkit";
import { isPassageQuestionItem } from "./createTestDomain";

const removeSubject = (state: CreateTestState, action: PayloadAction<string>) => {
  const removedSubjectIndex = state.subjects.findIndex((subject) => subject.id === action.payload);

  if (removedSubjectIndex === -1) {
    return;
  }

  const removedSubject = state.subjects[removedSubjectIndex];
  const removedQuestionIds = new Set<string>();

  removedSubject.questions.forEach((question) => {
    removedQuestionIds.add(question.id);

    if (isPassageQuestionItem(question)) {
      question.childQuestions.forEach((childQuestion) => {
        removedQuestionIds.add(childQuestion.id);
      });
    }
  });

  state.subjects.splice(removedSubjectIndex, 1);

  if (state.activeSubjectId === action.payload) {
    const nextActiveSubject =
      state.subjects[removedSubjectIndex] ?? state.subjects[removedSubjectIndex - 1] ?? state.subjects[0] ?? null;

    state.activeSubjectId = nextActiveSubject?.id ?? null;
  }

  if (state.activeQuestionId && removedQuestionIds.has(state.activeQuestionId)) {
    state.activeQuestionId = null;
  }

  if (state.activePassageId && removedQuestionIds.has(state.activePassageId)) {
    state.activePassageId = null;
  }

  if (state.pendingFocusQuestion?.subjectId === action.payload) {
    state.pendingFocusQuestion = null;
  }

  if (state.pendingFocusOption?.subjectId === action.payload) {
    state.pendingFocusOption = null;
  }

  if (state.dragState?.subjectId === action.payload) {
    state.dragState = null;
  }
};

export default removeSubject;
