import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import {
  createId,
  findSubjectSection,
  focusQuestion,
  getFirstInvalidQuestion,
  showSectionValidationErrors,
} from "./createTestDomain";

const duplicateQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const { section, subject } = findSubjectSection(state.subjects, action.payload.subjectId, action.payload.sectionId);

  if (!section || !subject) {
    return;
  }

  const target = section.questions.find((question) => question.id === action.payload.questionId);

  if (!target) {
    return;
  }

  const invalidQuestion = getFirstInvalidQuestion(section);

  if (invalidQuestion) {
    showSectionValidationErrors(section);
    focusQuestion(state, subject.id, section.id, invalidQuestion.id);
    return;
  }

  const optionIdMap = new Map<string, string>();
  const clonedOptions = (target.options ?? []).map((option) => {
    const newId = createId();
    optionIdMap.set(option.id, newId);

    return {
      ...option,
      id: newId,
    };
  });

  const duplicatedQuestion: QuestionItem = {
    ...target,
    id: createId(),
    ...(section.type === "objective"
      ? {
          options: clonedOptions,
          correctOptionId: target.correctOptionId ? optionIdMap.get(target.correctOptionId) || null : null,
        }
      : { options: undefined, correctOptionId: undefined }),
    showValidation: false,
  };

  const index = section.questions.findIndex((question) => question.id === action.payload.questionId);
  section.questions.splice(index + 1, 0, duplicatedQuestion);
  focusQuestion(state, subject.id, section.id, duplicatedQuestion.id);
};

export default duplicateQuestion;