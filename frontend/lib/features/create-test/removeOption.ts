import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import type { OptionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const removeOption = (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);
  const optionRules = question ? getCreateTestQuestionOptionRules(question.type, question.subType) : null;

  if (!question?.options || !optionRules?.canRemoveOptions) {
    return;
  }

  question.options = question.options.filter((entry) => entry.id !== action.payload.optionId);

  if (question.answer?.type === "optionId") {
    question.answer = {
      type: "optionId",
      value: question.answer.value.filter((optionId) => optionId !== action.payload.optionId),
    };
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
