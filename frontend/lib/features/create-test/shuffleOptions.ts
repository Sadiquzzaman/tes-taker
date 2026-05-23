import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import { findSubjectSection } from "./createTestDomain";

const shuffleOptions = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const { section } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (!section || section.type !== "objective") {
    return;
  }

  const question = section.questions.find((entry) => entry.id === action.payload.questionId);

  if (!question?.options) {
    return;
  }

  for (let index = question.options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [question.options[index], question.options[swapIndex]] = [question.options[swapIndex], question.options[index]];
  }
};

export default shuffleOptions;
