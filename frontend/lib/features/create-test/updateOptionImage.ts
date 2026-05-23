import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateOptionImage = (state: CreateTestState, action: PayloadAction<OptionPayload & { image: string | null }>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
  const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
  const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

  if (option) {
    option.image = action.payload.image;
  }
};

export default updateOptionImage;
