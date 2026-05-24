import type { PayloadAction } from "@reduxjs/toolkit";
import type { SubjectSelectionPayload } from "./createTestActionPayloads";
import { createSubject, resetTransientState } from "./createTestDomain";

const setSingleSubject = (state: CreateTestState, action: PayloadAction<SubjectSelectionPayload>) => {
  const existingSubject = state.subjects.find((subject) => subject.value === action.payload.value) ?? null;
  const nextSubject = createSubject(
    {
      name: action.payload.label,
      value: action.payload.value,
      id: existingSubject?.id ?? action.payload.id,
    },
    existingSubject?.questions ?? [],
  );

  state.subjects = [nextSubject];
  state.activeSubjectId = nextSubject.id;
  resetTransientState(state);
};

export default setSingleSubject;
