import type { PayloadAction } from "@reduxjs/toolkit";

const setPublishField = (state: CreateTestState, action: PayloadAction<SetPublishFieldPayload>) => {
  (state.publishState[action.payload.field] as string) = action.payload.value;
  // A subject class belongs to one class: choosing another class starts again with the whole class.
  if (action.payload.field === "selectedClassId") {
    state.publishState.selectedOfferingId = "";
  }
};

export default setPublishField;
