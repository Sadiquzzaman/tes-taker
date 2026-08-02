import type { PayloadAction } from "@reduxjs/toolkit";
import {
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID,
  getCreateTestQuestionAnswerInputMode,
  getCreateTestQuestionAnswerMode,
  getCreateTestQuestionOptionRules,
  getCreateTestQuestionSupportsAlternativeAnswers,
  isCreateTestObjectiveCategory,
  isCreateTestQuestionCreationSupported,
} from "@/utils/createTestOptions";
import {
  buildMatchingOrderingAnswerValue,
  createMatchingOrderingAnswer,
  createOption,
  findSubjectQuestion,
} from "./createTestDomain";

export type ChangeQuestionSubtypePayload = {
  subjectId: string;
  questionId: string;
  parentPassageId?: string | null;
  nextSubType: string;
};

export type QuestionSubtypeConversionPreview = {
  nextSubType: string;
  willLoseOptions: boolean;
  willLoseCorrectAnswer: boolean;
  willLoseMatching: boolean;
  willLoseTextAnswers: boolean;
  warningMessage: string | null;
};

const TRUE_FALSE_OPTIONS = ["True", "False", "Not Given"];

export const previewQuestionSubtypeConversion = (
  question: QuestionItem,
  nextSubType: string,
): QuestionSubtypeConversionPreview => {
  const nextRules = getCreateTestQuestionOptionRules(question.type, nextSubType);
  const nextAnswerMode = getCreateTestQuestionAnswerMode(question.type, nextSubType);
  const nextAnswerInput = getCreateTestQuestionAnswerInputMode(question.type, nextSubType);
  const isMatchingTarget = nextSubType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID;
  const hasOptions = Boolean(question.options?.length);
  const hasMatching = Boolean(question.matchingOptions?.left?.length);
  const hasTextAnswers = question.answer?.type === "text" && (question.answer.value ?? []).some((value) => value.trim());
  const hasOptionAnswers = question.answer?.type === "optionId" && (question.answer.value?.length ?? 0) > 0;

  const willLoseMatching = hasMatching && !isMatchingTarget;
  const willLoseOptions = hasOptions && (!nextRules || isMatchingTarget);
  const willLoseCorrectAnswer =
    (hasOptionAnswers && nextAnswerMode === "none" && nextAnswerInput !== "correct-answer") ||
    (hasTextAnswers && nextAnswerInput !== "correct-answer");
  const willLoseTextAnswers = hasTextAnswers && nextAnswerInput !== "correct-answer";

  const losses: string[] = [];
  if (willLoseMatching) {
    losses.push("matching pairs");
  }
  if (willLoseOptions) {
    losses.push("multiple-choice options");
  }
  if (willLoseCorrectAnswer || willLoseTextAnswers) {
    losses.push("correct answer settings");
  }

  return {
    nextSubType,
    willLoseOptions,
    willLoseCorrectAnswer,
    willLoseMatching,
    willLoseTextAnswers,
    warningMessage: losses.length
      ? `Changing type will clear: ${losses.join(", ")}. Question text, instruction, image, and marks are kept.`
      : null,
  };
};

const changeQuestionSubtype = (state: CreateTestState, action: PayloadAction<ChangeQuestionSubtypePayload>) => {
  const { question } = findSubjectQuestion(
    state.subjects,
    action.payload.subjectId,
    action.payload.questionId,
    action.payload.parentPassageId,
  );

  if (!question) {
    return;
  }

  const nextSubType = action.payload.nextSubType;
  if (!isCreateTestQuestionCreationSupported(question.type, nextSubType)) {
    return;
  }

  if (question.subType === nextSubType) {
    return;
  }

  const preservedText = question.text;
  const preservedInstruction = question.instruction;
  const preservedImage = question.image;
  const preservedPoints = question.points;

  const optionRules = getCreateTestQuestionOptionRules(question.type, nextSubType);
  const answerMode = getCreateTestQuestionAnswerMode(question.type, nextSubType);
  const answerInputMode = getCreateTestQuestionAnswerInputMode(question.type, nextSubType);
  const supportsAlternatives = getCreateTestQuestionSupportsAlternativeAnswers(question.type, nextSubType);

  question.subType = nextSubType;
  question.text = preservedText;
  question.instruction = preservedInstruction;
  question.image = preservedImage;
  question.points = preservedPoints;
  question.showValidation = false;

  if (nextSubType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID) {
    const left = [createOption("Left 1"), createOption("Left 2")];
    const right = [createOption("Right 1"), createOption("Right 2")];
    question.options = undefined;
    question.matchingOptions = { left, right };
    question.answer = createMatchingOrderingAnswer(buildMatchingOrderingAnswerValue({ left, right }));
    return;
  }

  question.matchingOptions = undefined;

  if (answerInputMode === "correct-answer") {
    const previousText =
      question.answer?.type === "text"
        ? question.answer.value
        : question.answer?.type === "optionId" && question.options?.length
          ? question.options
              .filter((option) => question.answer?.value?.includes(option.id))
              .map((option) => option.text)
          : [""];
    question.options = undefined;
    question.answer = {
      type: "text",
      value: supportsAlternatives ? [previousText[0] ?? "", previousText[1] ?? ""] : [previousText[0] ?? ""],
    };
    return;
  }

  if (optionRules?.useFixedOptions && nextSubType === CREATE_TEST_GRADED_TRUE_FALSE_SUBTYPE_ID) {
    question.options = TRUE_FALSE_OPTIONS.map((text) => createOption(text));
    question.answer = { type: "optionId", value: [] };
    return;
  }

  if (optionRules && isCreateTestObjectiveCategory(question.type) && answerMode !== "none") {
    const previousOptions = question.options ?? [];
    const minOptions = optionRules.minOptions;
    const nextOptions =
      previousOptions.length >= minOptions
        ? previousOptions.slice(0, optionRules.maxOptions)
        : [
            ...previousOptions,
            ...Array.from({ length: minOptions - previousOptions.length }, (_, index) =>
              createOption(`Option ${previousOptions.length + index + 1}`),
            ),
          ];
    question.options = nextOptions.length ? nextOptions : [createOption("Option 1"), createOption("Option 2"), createOption("Option 3")];

    if (question.answer?.type === "optionId") {
      const validIds = new Set(question.options.map((option) => option.id));
      question.answer = {
        type: "optionId",
        value: (question.answer.value ?? []).filter((id) => validIds.has(id)),
      };
    } else {
      question.answer = { type: "optionId", value: [] };
    }
    return;
  }

  // Ungraded essay / gaps / etc.
  question.options = undefined;
  question.answer = undefined;
};

export default changeQuestionSubtype;
