import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import { createOption, findSubjectQuestion, focusOption } from "./createTestDomain";

const addOption = (state: CreateTestState, action: PayloadAction<QuestionPayload & { image?: string | null }>) => {
  const { question, subject } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
  );
  const optionRules = question ? getCreateTestQuestionOptionRules(question.type, question.subType) : null;

  if (!question || !subject || !optionRules?.canAddOptions) {
    return;
  }

  question.options = question.options ?? [];

  if (question.options.length >= optionRules.maxOptions) {
    return;
  }

  const nextOption = createOption(action.payload.image ? " " : "", action.payload.image ?? null);
  question.options.push(nextOption);
  focusOption(state, subject.id, question.id, nextOption.id);
};

export default addOption;
