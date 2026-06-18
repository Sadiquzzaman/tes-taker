import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import {
  buildMatchingOrderingAnswerValue,
  createId,
  createMatchingOrderingAnswer,
  findSubjectQuestion,
  focusPassage,
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
    action.payload.parentPassageId,
  );

  if (!target || !subject) {
    return;
  }

  const invalidQuestion = getFirstInvalidQuestion(subject.id, subject.questions);

  if (invalidQuestion) {
    showQuestionValidationErrors(subject.questions);

    if (invalidQuestion.targetType === "passage" && invalidQuestion.parentPassageId) {
      focusPassage(state, subject.id, invalidQuestion.parentPassageId);
      return;
    }

    if (invalidQuestion.questionId) {
      focusQuestion(state, subject.id, invalidQuestion.questionId, invalidQuestion.parentPassageId);
    }
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
    target.type === "ungraded"
      ? undefined
      : target.answer?.type === "matchingOrdering" && clonedMatchingOptions
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
    ...(clonedMatchingOptions
      ? { options: undefined }
      : optionRules
        ? { options: clonedOptions }
        : { options: undefined }),
    showValidation: false,
  };

  if (action.payload.parentPassageId) {
    const { parentPassage } = findSubjectQuestion(
      state.subjects,
      action.payload.subjectId,
      action.payload.questionId,
      action.payload.parentPassageId,
    );

    if (!parentPassage) {
      return;
    }

    const index = parentPassage.childQuestions.findIndex((question) => question.id === action.payload.questionId);
    parentPassage.childQuestions.splice(index + 1, 0, duplicatedQuestion);
    syncSubjectType(subject);
    focusQuestion(state, subject.id, duplicatedQuestion.id, parentPassage.id);
    return;
  }

  const index = subject.questions.findIndex((question) => question.id === action.payload.questionId);
  subject.questions.splice(index + 1, 0, duplicatedQuestion);
  syncSubjectType(subject);
  focusQuestion(state, subject.id, duplicatedQuestion.id);
};

export default duplicateQuestion;
