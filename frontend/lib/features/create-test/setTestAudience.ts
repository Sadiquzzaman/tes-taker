import type { PayloadAction } from "@reduxjs/toolkit";

const setTestAudience = (state: CreateTestState, action: PayloadAction<TestAudience>) => {
  state.publishState.testAudience = action.payload;
};

export default setTestAudience;
