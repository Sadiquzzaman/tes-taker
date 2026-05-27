import type { PayloadAction } from "@reduxjs/toolkit";

const setFormField = (state: CreateTestState, action: PayloadAction<SetFormFieldPayload>) => {
  state.formState[action.payload.field] = action.payload.value as never;
};

export default setFormField;
