import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionAnswerMode } from "@/utils/createTestOptions";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";
import { findSubjectQuestion } from "./createTestDomain";

const updateQuestionValidationVisibility = (question: QuestionItem) => {
  if (!question.showValidation) {
    return;
  }

  question.showValidation = getQuestionValidationErrors(question).length > 0;
};

const selectCorrectOption = (state: CreateTestState, action: PayloadAction<OptionPayload>) => {
  const { question } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );
  const answerMode = question ? getCreateTestQuestionAnswerMode(question.type, question.subType) : "none";
  const hasMatchingOption = question?.options?.some((option) => option.id === action.payload.optionId);

  if (!question || !hasMatchingOption || answerMode === "none") {
    return;
  }

  if (answerMode === "multiple") {
    const selectedOptionIds = new Set(question.answer?.type === "optionId" ? question.answer.value : []);

    if (selectedOptionIds.has(action.payload.optionId)) {
      selectedOptionIds.delete(action.payload.optionId);
    } else {
      selectedOptionIds.add(action.payload.optionId);
    }

    question.answer = {
      type: "optionId",
      value: Array.from(selectedOptionIds),
    };
    updateQuestionValidationVisibility(question);
    return;
  }

  if (answerMode === "single") {
    question.answer = {
      type: "optionId",
      value: [action.payload.optionId],
    };
    updateQuestionValidationVisibility(question);
  }
};

export default selectCorrectOption;
