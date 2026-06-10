import type { PayloadAction } from "@reduxjs/toolkit";
import { findSubjectQuestion } from "./createTestDomain";

const updateQuestionImage = (
  state: CreateTestState,
  action: PayloadAction<QuestionPayload & { image: string | null }>,
) => {
  const { question } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );

  if (question) {
    question.image = action.payload.image;
  }
};

export default updateQuestionImage;
