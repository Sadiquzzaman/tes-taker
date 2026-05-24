import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const updateQuestionPoints = (state: CreateTestState, action: PayloadAction<QuestionPayload & { points: number }>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (question) {
    question.points = Math.max(0, action.payload.points || 0);
  }
};

export default updateQuestionPoints;
