import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const updateOptionText = (state: CreateTestState, action: PayloadAction<OptionPayload & { text: string }>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);
  const optionRules = question ? getCreateTestQuestionOptionRules(question.type, question.subType) : null;

  if (!optionRules?.canEditOptionText) {
    return;
  }

  const option = question?.options?.find((entry) => entry.id === action.payload.optionId);

  if (option) {
    option.text = action.payload.text;
  }
};

export default updateOptionText;
