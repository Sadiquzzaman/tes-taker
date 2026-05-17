import type { PayloadAction } from "@reduxjs/toolkit";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const selectCorrectOption = (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (!section || section.type !== "objective") {
    return;
  }

  const question = section.questions.find((entry) => entry.id === action.payload.questionId);

  if (question) {
    question.correctOptionId = action.payload.optionId;
    question.showValidation = false;
  }
};

export default selectCorrectOption;