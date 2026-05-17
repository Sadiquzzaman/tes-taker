import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateQuestionImage = (
  state: CreateTestState,
  action: PayloadAction<QuestionPayload & { image: string | null }>,
) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
  const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

  if (question) {
    question.image = action.payload.image;
  }
};

export default updateQuestionImage;