import type { PayloadAction } from "@reduxjs/toolkit";
import { findSubjectQuestion } from "./createTestDomain";

const updateQuestionText = (state: CreateTestState, action: PayloadAction<QuestionPayload & { text: string }>) => {
  const { question } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );

  if (question) {
    question.text = action.payload.text;
  }
};

export default updateQuestionText;
