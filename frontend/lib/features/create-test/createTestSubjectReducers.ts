import type { PayloadAction } from "@reduxjs/toolkit";
import { createQuestionSections, createSubject, resetTransientState } from "./createTestDomain";

type SubjectSelectionPayload = {
  label: string;
  value: string;
  id: string;
};

export const createTestSubjectReducers = {
  setSingleSubject: (state: CreateTestState, action: PayloadAction<SubjectSelectionPayload>) => {
    const existingSubject = state.subjects.find((subject) => subject.value === action.payload.value) ?? null;
    const nextSubject = existingSubject
      ? {
          ...existingSubject,
          name: action.payload.label,
          value: action.payload.value,
          questionSections: createQuestionSections(state.formState.examType, existingSubject.questionSections),
        }
      : createSubject(state.formState.examType, {
          name: action.payload.label,
          value: action.payload.value,
          id: action.payload.id,
        });

    state.subjects = [nextSubject];
    state.activeSubjectId = nextSubject.id;
    resetTransientState(state);
  },
  addSubject: (state: CreateTestState, action: PayloadAction<SubjectSelectionPayload>) => {
    const existingSubject = state.subjects.find((subject) => subject.value === action.payload.value);

    if (existingSubject) {
      state.activeSubjectId = existingSubject.id;
      resetTransientState(state);
      return;
    }

    const nextSubject = createSubject(state.formState.examType, {
      name: action.payload.label,
      value: action.payload.value,
      id: action.payload.id,
    });

    state.subjects.push(nextSubject);
    state.activeSubjectId = nextSubject.id;
    resetTransientState(state);
  },
  removeSubject: (state: CreateTestState, action: PayloadAction<string>) => {
    const removedSubjectIndex = state.subjects.findIndex((subject) => subject.id === action.payload);

    if (removedSubjectIndex === -1) {
      return;
    }

    const removedSubject = state.subjects[removedSubjectIndex];
    const removedQuestionIds = new Set(
      removedSubject.questionSections.flatMap((section) => section.questions.map((question) => question.id)),
    );

    state.subjects.splice(removedSubjectIndex, 1);

    if (state.activeSubjectId === action.payload) {
      const nextActiveSubject =
        state.subjects[removedSubjectIndex] ?? state.subjects[removedSubjectIndex - 1] ?? state.subjects[0] ?? null;

      state.activeSubjectId = nextActiveSubject?.id ?? null;
    }

    if (state.activeQuestionId && removedQuestionIds.has(state.activeQuestionId)) {
      state.activeQuestionId = null;
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
  },
  setActiveSubjectId: (state: CreateTestState, action: PayloadAction<string | null>) => {
    state.activeSubjectId = action.payload;
    resetTransientState(state);
  },
};