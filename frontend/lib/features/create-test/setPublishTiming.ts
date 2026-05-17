import type { PayloadAction } from "@reduxjs/toolkit";

const setPublishTiming = (state: CreateTestState, action: PayloadAction<PublishTiming>) => {
  state.publishState.publishTiming = action.payload;
};

export default setPublishTiming;