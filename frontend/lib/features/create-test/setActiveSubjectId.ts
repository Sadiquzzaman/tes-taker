import type { PayloadAction } from "@reduxjs/toolkit";
import { resetTransientState } from "./createTestDomain";

const setActiveSubjectId = (state: CreateTestState, action: PayloadAction<string | null>) => {
  state.activeSubjectId = action.payload;
  resetTransientState(state);
};

export default setActiveSubjectId;
