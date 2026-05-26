import {
  getCreateTestQuestionAnswerInputMode,
  getCreateTestQuestionAnswerMode,
  getCreateTestQuestionOptionRules,
  getCreateTestQuestionSubtype,
} from "@/utils/createTestOptions";

const hasTextOrImage = (text: string, image: string | null | undefined) => Boolean(text.trim() || image);

const getSubtypeLabel = (question: QuestionItem) =>
  getCreateTestQuestionSubtype(question.type, question.subType)?.label;

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

    if (correctOptionIds.length === 0) {
      errors.push("Select at least one correct option.");
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

  if (!hasTextOrImage(question.text, question.image)) {
    errors.push("Add a question title or question image.");
  }

  if (question.points <= 0) {
    errors.push("Points must be greater than 0.");
  }

  if (answerInputMode === "correct-answer" && !textAnswerValue.trim()) {
    errors.push("Add a correct answer.");
  }

  if (question.type === "graded") {
    errors.push(...getSubtypeOptionValidationErrors(question));
  }

  return errors;
};

export const collectQuestionValidationFailures = (subjects: SubjectItem[]): QuestionValidationFailure[] => {
  const failures: QuestionValidationFailure[] = [];

  subjects.forEach((subject) => {
    subject.questions.forEach((question) => {
      const errors = getQuestionValidationErrors(question);

      if (errors.length > 0) {
        failures.push({
          subjectId: subject.id,
          questionId: question.id,
          errors,
        });
      }
    });
  });

  return failures;
};

export const getSubjectQuestionCount = (subject: SubjectItem): number => subject.questions.length;
