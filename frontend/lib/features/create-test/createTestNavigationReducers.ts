import type { PayloadAction } from "@reduxjs/toolkit";
import { createInitialState, createTestSteps, resetTransientState, syncSubjectsForExamType } from "./createTestDomain";

export const createTestNavigationReducers = {
  resetForm: () => createInitialState(),
  goToNextStep: (state: CreateTestState) => {
    const currentIndex = createTestSteps.indexOf(state.currentStep);

    if (currentIndex < createTestSteps.length - 1) {
      state.currentStep = createTestSteps[currentIndex + 1];
    }
  },
  goToPreviousStep: (state: CreateTestState) => {
    const currentIndex = createTestSteps.indexOf(state.currentStep);

    if (currentIndex > 0) {
      state.currentStep = createTestSteps[currentIndex - 1];
    }
  },
  setFormField: (state: CreateTestState, action: PayloadAction<{ field: keyof FormState; value: FormState[keyof FormState] }>) => {
    state.formState[action.payload.field] = action.payload.value as never;

    if (action.payload.field === "examType") {
      const nextExamType = String(action.payload.value);

      state.subjects = syncSubjectsForExamType(state.subjects, nextExamType, state.activeSubjectId);
      state.activeSubjectId = state.subjects[0]?.id ?? null;
      resetTransientState(state);
    }
  },
};