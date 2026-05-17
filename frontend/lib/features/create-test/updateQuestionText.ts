import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateQuestionText = (state: CreateTestState, action: PayloadAction<QuestionPayload & { text: string }>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
  const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

  if (question) {
    question.text = action.payload.text;
  }
};

export default updateQuestionText;