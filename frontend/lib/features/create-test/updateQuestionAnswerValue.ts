import type { PayloadAction } from "@reduxjs/toolkit";
import {
  getCreateTestQuestionAnswerInputMode,
  getCreateTestQuestionSupportsAlternativeAnswers,
} from "@/utils/createTestOptions";
import { findSubjectQuestion } from "./createTestDomain";

const updateQuestionAnswerValue = (state: CreateTestState, action: PayloadAction<QuestionAnswerValuePayload>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (!question || getCreateTestQuestionAnswerInputMode(question.type, question.subType) !== "correct-answer") {
    return;
  }

  const supportsAlternativeAnswers = getCreateTestQuestionSupportsAlternativeAnswers(question.type, question.subType);
  const nextValues =
    question.answer?.type === "text" ? [...question.answer.value] : supportsAlternativeAnswers ? ["", ""] : [""];

  if (action.payload.index === 0) {
    nextValues[0] = action.payload.value;
  }

  if (!supportsAlternativeAnswers) {
    question.answer = {
      type: "text",
      value: [nextValues[0] ?? ""],
    };
    question.showValidation = false;
    return;
  }

  if (!(nextValues[0] ?? "").trim()) {
    question.answer = {
      type: "text",
      value: [nextValues[0] ?? "", ""],
    };
    question.showValidation = false;
    return;
  }

  if (action.payload.index === 1) {
    nextValues[1] = action.payload.value;
  }

  question.answer = {
    type: "text",
    value: [nextValues[0] ?? "", nextValues[1] ?? ""],
  };
  question.showValidation = false;
};

export default updateQuestionAnswerValue;
