import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const updateQuestionInstruction = (
  state: CreateTestState,
  action: PayloadAction<QuestionPayload & { instruction: string }>,
) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);
  const question = section?.questions.find((entry) => entry.id === action.payload.questionId);

  if (question) {
    question.instruction = action.payload.instruction;
  }
};

export default updateQuestionInstruction;