import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import {
  buildMatchingOrderingAnswerValue,
  createMatchingOrderingAnswer,
  createOption,
  findSubjectQuestion,
  focusOption,
} from "./createTestDomain";

const addMatchingPair = (state: CreateTestState, action: PayloadAction<QuestionPayload>) => {
  const { question, subject } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );
  const optionRules = question ? getCreateTestQuestionOptionRules(question.type, question.subType) : null;

  if (!question || !subject || !optionRules?.canAddOptions) {
    return;
  }

  question.matchingOptions = question.matchingOptions ?? { left: [], right: [] };

  if (question.matchingOptions.left.length >= optionRules.maxOptions) {
    return;
  }

  const leftOption = createOption("", null);
  const rightOption = createOption("", null);

  question.matchingOptions.left.push(leftOption);
  question.matchingOptions.right.push(rightOption);
  question.answer = createMatchingOrderingAnswer(buildMatchingOrderingAnswerValue(question.matchingOptions));
  focusOption(state, subject.id, question.id, leftOption.id, action.payload.parentPassageId);
};

export default addMatchingPair;
