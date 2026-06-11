import {
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  getCreateTestQuestionAnswerInputMode,
  getCreateTestQuestionAnswerMode,
  getCreateTestQuestionOptionRules,
  getCreateTestQuestionSubtype,
  isCreateTestObjectiveCategory,
} from "@/utils/createTestOptions";

const hasTextOrImage = (text: string, image: string | null | undefined) => Boolean(text.trim() || image);
const isPassageQuestionItem = (question: RootQuestionItem): question is PassageQuestionItem =>
  "childQuestions" in question;

const getSubtypeLabel = (question: QuestionItem) =>
  getCreateTestQuestionSubtype(question.type, question.subType)?.label;

const getMatchingOrderingValidationErrors = (question: QuestionItem): string[] => {
  const errors: string[] = [];
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
    errors.push("Matching /Ordering questions must have between 2 and 5 pairs.");
  }

  leftOptions.forEach((option, index) => {
    if (!option.text.trim()) {
      errors.push(`Left choice ${index + 1} cannot be empty.`);
    }
  });

  rightOptions.forEach((option, index) => {
    if (!option.text.trim()) {
      errors.push(`Right choice ${index + 1} cannot be empty.`);
    }
  });

  return errors;
};

const getSubtypeOptionValidationErrors = (question: QuestionItem): string[] => {
  const optionRules = getCreateTestQuestionOptionRules(question.type, question.subType);
  const answerMode = getCreateTestQuestionAnswerMode(question.type, question.subType);

  if (!optionRules) {
    return [];
  }

  const errors: string[] = [];
  const options = question.options ?? [];
  const subtypeLabel = getSubtypeLabel(question) ?? "This";

  if (optionRules.useFixedOptions) {
    const hasExpectedFixedOptions =
      options.length === optionRules.fixedOptions.length &&
      options.every(
        (option, index) =>
          option.text === optionRules.fixedOptions[index]?.text &&
          option.image === optionRules.fixedOptions[index]?.image,
      );

    if (!hasExpectedFixedOptions) {
      errors.push(`${subtypeLabel} questions must keep the fixed True, False, and Not Given options.`);
    }
  } else if (options.length < optionRules.minOptions || options.length > optionRules.maxOptions) {
    errors.push(
      `${subtypeLabel} questions must have between ${optionRules.minOptions} and ${optionRules.maxOptions} options.`,
    );
  }

  options.forEach((option, index) => {
    if (!hasTextOrImage(option.text, option.image)) {
      errors.push(`Option ${index + 1} must have text or an image.`);
    }
  });

  const validOptionIds = new Set(options.map((option) => option.id));
  const optionAnswerValues = question.answer?.type === "optionId" ? question.answer.value : [];

  if (answerMode === "multiple") {
    const correctOptionIds = optionAnswerValues.filter((optionId) => validOptionIds.has(optionId));

    if (correctOptionIds.length < 2) {
      errors.push("Select at least two correct options.");
    }

    return errors;
  }

  if (answerMode === "single") {
    const correctOptionId = optionAnswerValues.find((optionId) => validOptionIds.has(optionId));

    if (!correctOptionId) {
      errors.push("Select one correct option.");
    }
  }

  return errors;
};

export const getQuestionValidationErrors = (question: QuestionItem): string[] => {
  const errors: string[] = [];
  const answerInputMode = getCreateTestQuestionAnswerInputMode(question.type, question.subType);
  const textAnswerValue = question.answer?.type === "text" ? (question.answer.value[0] ?? "") : "";
  const isMatchingOrdering =
    isCreateTestObjectiveCategory(question.type) &&
    question.subType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID;

  if (isMatchingOrdering && !question.text.trim()) {
    errors.push("Add a question title.");
  } else if (!hasTextOrImage(question.text, question.image)) {
    errors.push("Add a question title or question image.");
  }

  if (question.points <= 0) {
    errors.push("Points must be greater than 0.");
  }

  if (answerInputMode === "correct-answer" && !textAnswerValue.trim()) {
    errors.push("Add a correct answer.");
  }

  if (isMatchingOrdering) {
    errors.push(...getMatchingOrderingValidationErrors(question));
  } else if (isCreateTestObjectiveCategory(question.type)) {
    errors.push(...getSubtypeOptionValidationErrors(question));
  }

  return errors;
};

export const getPassageValidationErrors = (question: PassageQuestionItem): string[] => {
  const errors: string[] = [];

  if (!question.passageText.trim()) {
    errors.push("Add passage text.");
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
