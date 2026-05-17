import type { PayloadAction } from "@reduxjs/toolkit";

const removeExcludedStudent = (state: CreateTestState, action: PayloadAction<number>) => {
  state.publishState.excluded_students.splice(action.payload, 1);
};

export default removeExcludedStudent;