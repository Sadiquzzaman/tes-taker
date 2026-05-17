import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateOptionText = (state: CreateTestState, action: PayloadAction<OptionPayload & { text: string }>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
  const question = section?.questions.find((entry) => entry.id === action.payload.questionId);
  const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

  if (option) {
    option.text = action.payload.text;
  }
};

export default updateOptionText;