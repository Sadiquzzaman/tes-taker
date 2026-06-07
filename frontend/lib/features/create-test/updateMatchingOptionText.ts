import type { PayloadAction } from "@reduxjs/toolkit";
import { findSubjectQuestion } from "./createTestDomain";

const updateMatchingOptionText = (state: CreateTestState, action: PayloadAction<MatchingOptionTextPayload>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);
  const optionList = question?.matchingOptions?.[action.payload.side];
  const option = optionList?.find((entry) => entry.id === action.payload.optionId);

  if (option) {
    option.text = action.payload.text;
  }
};

export default updateMatchingOptionText;
