import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectQuestion } from "./createTestDomain";

const updateQuestionInstruction = (
  state: CreateTestState,
  action: PayloadAction<QuestionPayload & { instruction: string }>,
) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (question) {
    question.instruction = action.payload.instruction;
  }
};

export default updateQuestionInstruction;
