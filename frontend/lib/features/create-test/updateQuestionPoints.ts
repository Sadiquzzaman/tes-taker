import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateQuestionPoints = (state: CreateTestState, action: PayloadAction<QuestionPayload & { points: number }>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
  const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

  if (question) {
    question.points = Math.max(0, action.payload.points || 0);
  }
};

export default updateQuestionPoints;
