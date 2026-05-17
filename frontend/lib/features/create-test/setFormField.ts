import type { PayloadAction } from "@reduxjs/toolkit";
import type { SetFormFieldPayload } from "./createTestActionPayloads";
import { resetTransientState, syncSubjectsForExamType } from "./createTestDomain";

const setFormField = (state: CreateTestState, action: PayloadAction<SetFormFieldPayload>) => {
  state.formState[action.payload.field] = action.payload.value as never;

  if (action.payload.field === "examType") {
    const nextExamType = String(action.payload.value);

    state.subjects = syncSubjectsForExamType(state.subjects, nextExamType, state.activeSubjectId);
    state.activeSubjectId = state.subjects[0]?.id ?? null;
    resetTransientState(state);
  }
};

export default setFormField;