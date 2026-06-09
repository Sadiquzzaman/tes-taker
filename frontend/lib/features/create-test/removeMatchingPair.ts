import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import {
  buildMatchingOrderingAnswerValue,
  createMatchingOrderingAnswer,
  findSubjectQuestion,
} from "./createTestDomain";

const removeMatchingPair = (state: CreateTestState, action: PayloadAction<MatchingPairPayload>) => {
  const { question } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );
  const optionRules = question ? getCreateTestQuestionOptionRules(question.type, question.subType) : null;
  const matchingOptions = question?.matchingOptions;

  if (!question || !matchingOptions || !optionRules?.canRemoveOptions) {
    return;
  }

  const leftOption = matchingOptions.left[action.payload.pairIndex];
  const rightOption = matchingOptions.right[action.payload.pairIndex];

  if (!leftOption || !rightOption) {
    return;
  }

  matchingOptions.left.splice(action.payload.pairIndex, 1);
  matchingOptions.right.splice(action.payload.pairIndex, 1);
  question.answer = createMatchingOrderingAnswer(buildMatchingOrderingAnswerValue(matchingOptions));

  if (
    state.pendingFocusOption?.subjectId === action.payload.subjectId &&
    state.pendingFocusOption.questionId === action.payload.questionId &&
    state.pendingFocusOption.parentPassageId === (action.payload.parentPassageId ?? null) &&
    (state.pendingFocusOption.optionId === leftOption.id || state.pendingFocusOption.optionId === rightOption.id)
  ) {
    state.pendingFocusOption = null;
  }
};

export default removeMatchingPair;
