import type { PayloadAction } from "@reduxjs/toolkit";
import { OBJECTIVE_MAX_OPTIONS } from "@/utils/createTestValidation";
import type { QuestionPayload } from "./createTestActionPayloads";
import { createOption, findSubjectQuestion, focusOption } from "./createTestDomain";

const addOption = (state: CreateTestState, action: PayloadAction<QuestionPayload & { image?: string | null }>) => {
  const { question, subject } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (!question || !subject || question.type !== "graded") {
    return;
  }

  question.options = question.options ?? [];

  if (question.options.length >= OBJECTIVE_MAX_OPTIONS) {
    return;
  }

  const nextOption = createOption(action.payload.image ? " " : "", action.payload.image ?? null);
  question.options.push(nextOption);
  focusOption(state, subject.id, question.id, nextOption.id);
};

export default addOption;
