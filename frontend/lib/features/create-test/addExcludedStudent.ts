import type { PayloadAction } from "@reduxjs/toolkit";

const addExcludedStudent = (state: CreateTestState, action: PayloadAction<string>) => {
  const trimmed = action.payload.trim();

  if (trimmed && !state.publishState.excluded_students.includes(trimmed)) {
    state.publishState.excluded_students.push(trimmed);
  }
};

export default addExcludedStudent;
