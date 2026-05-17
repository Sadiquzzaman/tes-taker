import type { PayloadAction } from "@reduxjs/toolkit";
import type { SetPublishFieldPayload } from "./createTestActionPayloads";

const setPublishField = (state: CreateTestState, action: PayloadAction<SetPublishFieldPayload>) => {
  (state.publishState[action.payload.field] as string) = action.payload.value;
};

export default setPublishField;