import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const removeOption = (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (!section || section.type !== "objective") {
    return;
  }

  const question = section.questions.find((entry) => entry.id === action.payload.questionId);

  if (!question?.options) {
    return;
  }

  question.options = question.options.filter((entry) => entry.id !== action.payload.optionId);

  if (question.correctOptionId === action.payload.optionId) {
    question.correctOptionId = null;
  }

  if (
    state.pendingFocusOption?.subjectId === action.payload.subjectId &&
    state.pendingFocusOption?.sectionId === action.payload.sectionId &&
    state.pendingFocusOption.questionId === action.payload.questionId &&
    state.pendingFocusOption.optionId === action.payload.optionId
  ) {
    state.pendingFocusOption = null;
  }
};

export default removeOption;