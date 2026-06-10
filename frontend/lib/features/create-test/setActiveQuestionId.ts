import type { PayloadAction } from "@reduxjs/toolkit";

const setActiveQuestionId = (state: CreateTestState, action: PayloadAction<SetActiveQuestionIdPayload>) => {
  state.activeQuestionId = action.payload.questionId;
  state.activePassageId = action.payload.parentPassageId ?? null;
};

export default setActiveQuestionId;
