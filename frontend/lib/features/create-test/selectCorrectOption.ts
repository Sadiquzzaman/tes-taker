import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const selectCorrectOption = (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (question?.type === "graded") {
    question.correctOptionId = action.payload.optionId;
    question.showValidation = false;
  }
};

export default selectCorrectOption;
