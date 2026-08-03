import type { PayloadAction } from "@reduxjs/toolkit";
import { getCreateTestQuestionAnswerMode, getCreateTestQuestionOptionRules } from "@/utils/createTestOptions";
import { createOption, findSubjectQuestion } from "./createTestDomain";

export type ApplyParsedQuestionPayload = {
  subjectId: string;
  questionId: string;
  parentPassageId?: string | null;
  question: string;
  options: string[];
  correctIndex: number | null;
  explanation?: string;
};

/**
 * Applies a rule-based pasted/OCR parse to a question card.
 * Structured MCQ paste replaces text, options, and correct answer.
 * Explanation (when present) populates the instruction field.
 */
const applyParsedQuestion = (state: CreateTestState, action: PayloadAction<ApplyParsedQuestionPayload>) => {
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
  const explanation = action.payload.explanation?.trim() ?? "";

  const isStructured = action.payload.options.length > 0 && supportsEditableOptions && answerMode !== "none";

  if (isStructured) {
    if (trimmedQuestion) {
      question.text = trimmedQuestion.includes("<") ? trimmedQuestion : `<p>${trimmedQuestion}</p>`;
    }

    const maxOptions = optionRules?.maxOptions ?? action.payload.options.length;
    const limitedOptions = action.payload.options.slice(0, maxOptions);
    const newOptions = limitedOptions.map((text) => createOption(text));

    question.options = newOptions;
    question.matchingOptions = undefined;

    const correctIndex = action.payload.correctIndex;
    const correctValue = correctIndex !== null && newOptions[correctIndex] ? [newOptions[correctIndex].id] : [];

    question.answer = { type: "optionId", value: correctValue };
    if (explanation) {
      question.instruction = explanation.includes("<") ? explanation : `<p>${explanation}</p>`;
    }
    question.showValidation = false;
    return;
  }

  if (trimmedQuestion) {
    question.text = trimmedQuestion.includes("<") ? trimmedQuestion : `<p>${trimmedQuestion}</p>`;
    question.showValidation = false;
  }

  if (explanation) {
    question.instruction = explanation.includes("<") ? explanation : `<p>${explanation}</p>`;
  }
};

export default applyParsedQuestion;
