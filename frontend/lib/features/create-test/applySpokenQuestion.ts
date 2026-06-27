import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionAnswerMode, getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import { createOption, findSubjectQuestion } from "./createTestDomain";

type ApplySpokenQuestionPayload = {
  subjectId: string;
  questionId: string;
  parentPassageId?: string | null;
  question: string;
  options: string[];
  correctIndex: number | null;
};

/**
 * Applies a rule-based parsed dictation to a question.
 * - When options are dictated for an option-based subtype, it replaces the question text,
 *   the options and the correct answer.
 * - Otherwise it simply appends the spoken text to the question title.
 */
const applySpokenQuestion = (state: CreateTestState, action: PayloadAction<ApplySpokenQuestionPayload>) => {
  const { question } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );

  if (!question) {
    return;
  }

  const optionRules = getCreateTestQuestionOptionRules(question.type, question.subType);
  const answerMode = getCreateTestQuestionAnswerMode(question.type, question.subType);
  const supportsEditableOptions = Boolean(optionRules?.canEditOptionText && !optionRules?.useFixedOptions);
  const trimmedQuestion = action.payload.question.trim();

  const isStructured =
    action.payload.options.length > 0 && supportsEditableOptions && answerMode !== "none";

  if (isStructured) {
    if (trimmedQuestion) {
      question.text = trimmedQuestion;
    }

    const maxOptions = optionRules?.maxOptions ?? action.payload.options.length;
    const limitedOptions = action.payload.options.slice(0, maxOptions);
    const newOptions = limitedOptions.map((text) => createOption(text));

    question.options = newOptions;
    question.matchingOptions = undefined;

    const correctIndex = action.payload.correctIndex;
    const correctValue =
      correctIndex !== null && newOptions[correctIndex] ? [newOptions[correctIndex].id] : [];

    question.answer = { type: "optionId", value: correctValue };
    question.showValidation = false;
    return;
  }

  if (trimmedQuestion) {
    const existing = question.text ?? "";
    const needsSpace = existing.length > 0 && !/\s$/.test(existing);
    question.text = `${existing}${needsSpace ? " " : ""}${trimmedQuestion}`;
    question.showValidation = false;
  }
};

export default applySpokenQuestion;
