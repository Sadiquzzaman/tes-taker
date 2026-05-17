import type { PayloadAction } from "@reduxjs/toolkit";
import { OBJECTIVE_MAX_OPTIONS } from "@/utils/createTestValidation";
import type { QuestionPayload } from "./createTestActionPayloads";
import { createOption, findSubjectSection, focusOption } from "./createTestDomain";

const addOption = (state: CreateTestState, action: PayloadAction<QuestionPayload & { image?: string | null }>) => {
  const { section, subject } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (!section || !subject || section.type !== "objective") {
    return;
  }

  const question = section.questions.find((entry) => entry.id === action.payload.questionId);

  if (!question) {
    return;
  }

  question.options = question.options ?? [];

  if (question.options.length >= OBJECTIVE_MAX_OPTIONS) {
    return;
  }

  const nextOption = createOption(action.payload.image ? " " : "", action.payload.image ?? null);
  question.options.push(nextOption);
  focusOption(state, subject.id, section.id, question.id, nextOption.id);
};

export default addOption;