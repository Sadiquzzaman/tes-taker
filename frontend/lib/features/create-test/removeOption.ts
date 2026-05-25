import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const removeOption = (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (!question?.options || question.type !== "graded") {
    return;
  }

  question.options = question.options.filter((entry) => entry.id !== action.payload.optionId);

  if (question.correctOptionId === action.payload.optionId) {
    question.correctOptionId = null;
  }

  if (
    state.pendingFocusOption?.subjectId === action.payload.subjectId &&
    state.pendingFocusOption.questionId === action.payload.questionId &&
    state.pendingFocusOption.optionId === action.payload.optionId
  ) {
    state.pendingFocusOption = null;
  }
};

export default removeOption;
