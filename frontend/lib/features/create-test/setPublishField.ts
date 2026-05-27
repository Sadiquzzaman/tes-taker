import type { PayloadAction } from "@reduxjs/toolkit";

const setPublishField = (state: CreateTestState, action: PayloadAction<SetPublishFieldPayload>) => {
  (state.publishState[action.payload.field] as string) = action.payload.value;
};

export default setPublishField;
