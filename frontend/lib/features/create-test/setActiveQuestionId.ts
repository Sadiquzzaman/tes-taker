import type { PayloadAction } from "@reduxjs/toolkit";

const setActiveQuestionId = (state: CreateTestState, action: PayloadAction<string | null>) => {
  state.activeQuestionId = action.payload;
};

export default setActiveQuestionId;
