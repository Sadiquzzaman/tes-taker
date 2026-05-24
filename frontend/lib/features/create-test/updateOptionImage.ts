import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const updateOptionImage = (state: CreateTestState, action: PayloadAction<OptionPayload & { image: string | null }>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);
  const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

  if (option) {
    option.image = action.payload.image;
  }
};

export default updateOptionImage;
