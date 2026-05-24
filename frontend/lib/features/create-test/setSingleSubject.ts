import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectSelectionPayload } from "./createTestActionPayloads";
import { createQuestionSections, createSubject, resetTransientState } from "./createTestDomain";

const setSingleSubject = (state: CreateTestState, action: PayloadAction<SubjectSelectionPayload>) => {
  const existingSubject = state.subjects.find((subject) => subject.value === action.payload.value) ?? null;
  const nextSubject = existingSubject
    ? {
        ...existingSubject,
        name: action.payload.label,
        value: action.payload.value,
        questionSections: createQuestionSections(existingSubject.questionSections),
      }
    : createSubject({
        name: action.payload.label,
        value: action.payload.value,
        id: action.payload.id,
      });

  state.subjects = [nextSubject];
  state.activeSubjectId = nextSubject.id;
  resetTransientState(state);
};

export default setSingleSubject;
