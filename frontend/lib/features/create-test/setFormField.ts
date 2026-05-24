import type { PayloadAction } from "@reduxjs/toolkit";
import type { SetFormFieldPayload } from "./createTestActionPayloads";

const setFormField = (state: CreateTestState, action: PayloadAction<SetFormFieldPayload>) => {
  state.formState[action.payload.field] = action.payload.value as never;
};

export default setFormField;
