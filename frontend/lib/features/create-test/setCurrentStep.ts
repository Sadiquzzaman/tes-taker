import type { PayloadAction } from "@reduxjs/toolkit";
import createTestSteps from "./createTestSteps";

const setCurrentStep = (state: CreateTestState, action: PayloadAction<CreateTestStep>) => {
  if (createTestSteps.includes(action.payload)) {
    state.currentStep = action.payload;
  }
};

export default setCurrentStep;
