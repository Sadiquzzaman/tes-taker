const hasTextOrImage = (text: string, image: string | null | undefined) => Boolean(text.trim() || image);

export const OBJECTIVE_MIN_OPTIONS = 2;
export const OBJECTIVE_MAX_OPTIONS = 5;

export type QuestionValidationFailure = {
  subjectId: string;
  questionId: string;
  errors: string[];
};

export const getQuestionValidationErrors = (question: QuestionItem): string[] => {
  const errors: string[] = [];

  if (!hasTextOrImage(question.text, question.image)) {
    errors.push("Add a question title or question image.");
  }

  if (question.points <= 0) {
    errors.push("Points must be greater than 0.");
  }

  if (question.type === "graded") {
    const options = question.options ?? [];

    if (options.length < OBJECTIVE_MIN_OPTIONS || options.length > OBJECTIVE_MAX_OPTIONS) {
      errors.push(
        `Objective questions must have between ${OBJECTIVE_MIN_OPTIONS} and ${OBJECTIVE_MAX_OPTIONS} options.`,
      );
    }

    options.forEach((option, index) => {
      if (!hasTextOrImage(option.text, option.image)) {
        errors.push(`Option ${index + 1} must have text or an image.`);
      }
    });

    if (!question.correctOptionId) {
      errors.push("Select one correct option.");
    }
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
