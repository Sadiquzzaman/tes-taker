import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectSelectionPayload } from "./createTestActionPayloads";
import { createSubject, resetTransientState } from "./createTestDomain";

const addSubject = (state: CreateTestState, action: PayloadAction<SubjectSelectionPayload>) => {
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
};

export default addSubject;