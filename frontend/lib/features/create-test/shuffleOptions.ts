import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import { findSubjectQuestion } from "./createTestDomain";

const shuffleOptions = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const { question } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);
  const optionRules = question ? getCreateTestQuestionOptionRules(question.type, question.subType) : null;

  if (!question?.options || !optionRules?.canShuffleOptions) {
    return;
  }

  for (let index = question.options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [question.options[index], question.options[swapIndex]] = [question.options[swapIndex], question.options[index]];
  }
};

export default shuffleOptions;
