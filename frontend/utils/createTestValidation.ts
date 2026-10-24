import {
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  getCreateTestQuestionAnswerInputMode,
  getCreateTestQuestionAnswerMode,
  getCreateTestQuestionOptionRules,
  isCreateTestAutoScoredSubType,
  isCreateTestObjectiveCategory,
  isCreateTestPassageManualSubType,
} from "@/utils/createTestOptions";
import { getPlainTextFromHtml, hasRichTextContent } from "@/utils/richText";

/**
 * A problem with a question, as a message key under `createTest.validation` (with its values),
 * so the builder can show it in the user's language.
 */
export type QuestionIssue = {
  key:
    | "matchingPairs"
    | "leftChoiceEmpty"
    | "rightChoiceEmpty"
    | "fixedOptions"
    | "optionCount"
    | "optionEmpty"
    | "pickTwoCorrect"
    | "pickOneCorrect"
    | "titleMissing"
    | "titleOrImageMissing"
    | "pointsPositive"
    | "answerMissing"
    | "passageMissing";
  values?: Record<string, number>;
};

const hasTextOrImage = (text: string, image: string | null | undefined) =>
  hasRichTextContent(text, image);
const isPassageQuestionItem = (question: RootQuestionItem): question is PassageQuestionItem =>
  "childQuestions" in question;

const getMatchingOrderingValidationErrors = (question: QuestionItem): QuestionIssue[] => {
  const errors: QuestionIssue[] = [];
  const matchingOptions = question.matchingOptions;
  const leftOptions = matchingOptions?.left ?? [];
  const rightOptions = matchingOptions?.right ?? [];

  if (
    leftOptions.length < 2 ||
    rightOptions.length < 2 ||
    leftOptions.length > 5 ||
    rightOptions.length > 5 ||
    leftOptions.length !== rightOptions.length
  ) {
    errors.push({ key: "matchingPairs", values: { min: 2, max: 5 } });
  }

  leftOptions.forEach((option, index) => {
    if (!option.text.trim()) {
      errors.push({ key: "leftChoiceEmpty", values: { number: index + 1 } });
    }
  });

  rightOptions.forEach((option, index) => {
    if (!option.text.trim()) {
      errors.push({ key: "rightChoiceEmpty", values: { number: index + 1 } });
    }
  });

  return errors;
};

const getSubtypeOptionValidationErrors = (question: QuestionItem): QuestionIssue[] => {
  const optionRules = getCreateTestQuestionOptionRules(question.type, question.subType);
  const answerMode = getCreateTestQuestionAnswerMode(question.type, question.subType);

  if (!optionRules) {
    return [];
  }

  const errors: QuestionIssue[] = [];
  const options = question.options ?? [];

  if (optionRules.useFixedOptions) {
    const hasExpectedFixedOptions =
      options.length === optionRules.fixedOptions.length &&
      options.every(
        (option, index) =>
          option.text === optionRules.fixedOptions[index]?.text &&
          option.image === optionRules.fixedOptions[index]?.image,
      );

    if (!hasExpectedFixedOptions) {
      errors.push({ key: "fixedOptions" });
    }
  } else if (options.length < optionRules.minOptions || options.length > optionRules.maxOptions) {
    errors.push({ key: "optionCount", values: { min: optionRules.minOptions, max: optionRules.maxOptions } });
  }

  options.forEach((option, index) => {
    if (!hasTextOrImage(option.text, option.image)) {
      errors.push({ key: "optionEmpty", values: { number: index + 1 } });
    }
  });

  const validOptionIds = new Set(options.map((option) => option.id));
  const optionAnswerValues = question.answer?.type === "optionId" ? question.answer.value : [];

  if (answerMode === "multiple") {
    const correctOptionIds = optionAnswerValues.filter((optionId) => validOptionIds.has(optionId));

    if (correctOptionIds.length < 2) {
      errors.push({ key: "pickTwoCorrect" });
    }

    return errors;
  }

  if (answerMode === "single") {
    const correctOptionId = optionAnswerValues.find((optionId) => validOptionIds.has(optionId));

    if (!correctOptionId) {
      errors.push({ key: "pickOneCorrect" });
    }
  }

  return errors;
};

export const getQuestionValidationErrors = (question: QuestionItem): QuestionIssue[] => {
  const errors: QuestionIssue[] = [];
  const answerInputMode = getCreateTestQuestionAnswerInputMode(question.type, question.subType);
  const textAnswerValue = question.answer?.type === "text" ? (question.answer.value[0] ?? "") : "";
  const isMatchingOrdering =
    isCreateTestObjectiveCategory(question.type) &&
    question.subType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID;

  if (isMatchingOrdering && !getPlainTextFromHtml(question.text)) {
    errors.push({ key: "titleMissing" });
  } else if (!hasTextOrImage(question.text, question.image)) {
    errors.push({ key: "titleOrImageMissing" });
  }

  if (question.points <= 0) {
    errors.push({ key: "pointsPositive" });
  }

  if (answerInputMode === "correct-answer" && !textAnswerValue.trim()) {
    errors.push({ key: "answerMissing" });
  }

  if (isMatchingOrdering) {
    errors.push(...getMatchingOrderingValidationErrors(question));
  } else if (isCreateTestObjectiveCategory(question.type) && isCreateTestAutoScoredSubType(question.subType)) {
    errors.push(...getSubtypeOptionValidationErrors(question));
  } else if (isCreateTestPassageManualSubType(question.subType)) {
    // Essay under Passage / CQ only needs text + points (validated above).
  }

  return errors;
};

export const getPassageValidationErrors = (question: PassageQuestionItem): QuestionIssue[] => {
  const errors: QuestionIssue[] = [];

  if (!hasRichTextContent(question.passageText)) {
    errors.push({ key: "passageMissing" });
  }

  return errors;
};

export const collectQuestionValidationFailures = (subjects: SubjectItem[]): QuestionValidationFailure[] => {
  const failures: QuestionValidationFailure[] = [];

  subjects.forEach((subject) => {
    subject.questions.forEach((question) => {
      if (isPassageQuestionItem(question)) {
        const passageErrors = getPassageValidationErrors(question);

        if (passageErrors.length > 0) {
          failures.push({
            subjectId: subject.id,
            questionId: question.id,
            parentPassageId: question.id,
            errors: passageErrors,
            targetType: "passage",
          });
        }

        question.childQuestions.forEach((childQuestion) => {
          const childErrors = getQuestionValidationErrors(childQuestion);

          if (childErrors.length > 0) {
            failures.push({
              subjectId: subject.id,
              questionId: childQuestion.id,
              parentPassageId: question.id,
              errors: childErrors,
              targetType: "question",
            });
          }
        });

        return;
      }

      const errors = getQuestionValidationErrors(question);

      if (errors.length > 0) {
        failures.push({
          subjectId: subject.id,
          questionId: question.id,
          errors,
          targetType: "question",
        });
      }
    });
  });

  return failures;
};

export const getSubjectQuestionCount = (subject: SubjectItem): number =>
  subject.questions.reduce((questionCount, question) => {
    if (isPassageQuestionItem(question)) {
      return questionCount + question.childQuestions.length;
    }

    return questionCount + 1;
  }, 0);
