import type { PayloadAction } from "@reduxjs/toolkit";

export const createTestPublishReducers = {
  setPublishTiming: (state: CreateTestState, action: PayloadAction<PublishTiming>) => {
    state.publishState.publishTiming = action.payload;
  },
  setPublishField: (
    state: CreateTestState,
    action: PayloadAction<{
      field: keyof Omit<PublishState, "publishTiming" | "testAudience" | "excluded_students">;
      value: string;
    }>,
  ) => {
    (state.publishState[action.payload.field] as string) = action.payload.value;
  },
  setTestAudience: (state: CreateTestState, action: PayloadAction<TestAudience>) => {
    state.publishState.testAudience = action.payload;
  },
  addExcludedStudent: (state: CreateTestState, action: PayloadAction<string>) => {
    const trimmed = action.payload.trim();

    if (trimmed && !state.publishState.excluded_students.includes(trimmed)) {
      state.publishState.excluded_students.push(trimmed);
    }
  },
  removeExcludedStudent: (state: CreateTestState, action: PayloadAction<number>) => {
    state.publishState.excluded_students.splice(action.payload, 1);
  },
};