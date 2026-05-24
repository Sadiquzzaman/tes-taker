import type { PayloadAction } from "@reduxjs/toolkit";
import type { QuestionPayload } from "./createTestActionPayloads";
import {
  createId,
  findSubjectQuestion,
  focusQuestion,
  getFirstInvalidQuestion,
  getSubjectQuestionsByType,
  showQuestionValidationErrors,
  syncSubjectType,
} from "./createTestDomain";

const duplicateQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const { question: target, subject } = findSubjectQuestion(state.subjects, action.payload.subjectId, action.payload.questionId);

  if (!target || !subject) {
    return;
  }

  const questionsOfType = getSubjectQuestionsByType(subject, target.type);
  const invalidQuestion = getFirstInvalidQuestion(questionsOfType);

  if (invalidQuestion) {
    showQuestionValidationErrors(questionsOfType);
    focusQuestion(state, subject.id, invalidQuestion.id);
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
    ...(target.type === "objective"
      ? {
          options: clonedOptions,
          correctOptionId: target.correctOptionId ? optionIdMap.get(target.correctOptionId) || null : null,
        }
      : { options: undefined, correctOptionId: undefined }),
    showValidation: false,
  };

  const index = subject.questions.findIndex((question) => question.id === action.payload.questionId);
  subject.questions.splice(index + 1, 0, duplicatedQuestion);
  syncSubjectType(subject);
  focusQuestion(state, subject.id, duplicatedQuestion.id);
};

export default duplicateQuestion;
