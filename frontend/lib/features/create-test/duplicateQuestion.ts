import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import {
  buildMatchingOrderingAnswerValue,
  createId,
  createMatchingOrderingAnswer,
  findSubjectQuestion,
  focusQuestion,
  getFirstInvalidQuestion,
  showQuestionValidationErrors,
  syncSubjectType,
} from "./createTestDomain";

const duplicateQuestion = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const { question: target, subject } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
  );

  if (!target || !subject) {
    return;
  }

  const invalidQuestion = getFirstInvalidQuestion(subject.questions);

  if (invalidQuestion) {
    showQuestionValidationErrors(subject.questions);
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
  const clonedMatchingOptions = target.matchingOptions
    ? {
        left: target.matchingOptions.left.map((option) => ({
          ...option,
          id: createId(),
        })),
        right: target.matchingOptions.right.map((option) => ({
          ...option,
          id: createId(),
        })),
      }
    : undefined;
  const optionRules = getCreateTestQuestionOptionRules(target.type, target.subType);
  const answer =
    target.answer?.type === "matchingOrdering" && clonedMatchingOptions
      ? createMatchingOrderingAnswer(buildMatchingOrderingAnswerValue(clonedMatchingOptions))
      : target.answer?.type === "optionId"
      ? {
          type: "optionId" as const,
          value: target.answer.value.map((optionId) => optionIdMap.get(optionId)).filter(Boolean) as string[],
        }
      : target.answer
        ? {
            type: "text" as const,
            value: [...target.answer.value],
          }
        : undefined;

  const duplicatedQuestion: QuestionItem = {
    ...target,
    id: createId(),
    answer,
    matchingOptions: clonedMatchingOptions,
    ...(clonedMatchingOptions ? { options: undefined } : optionRules ? { options: clonedOptions } : { options: undefined }),
    showValidation: false,
  };

  const index = subject.questions.findIndex((question) => question.id === action.payload.questionId);
  subject.questions.splice(index + 1, 0, duplicatedQuestion);
  syncSubjectType(subject);
  focusQuestion(state, subject.id, duplicatedQuestion.id);
};

export default duplicateQuestion;
