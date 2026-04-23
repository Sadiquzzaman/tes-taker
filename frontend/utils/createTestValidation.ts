const hasTextOrImage = (text: string, image: string | null | undefined) => Boolean(text.trim() || image);

export type QuestionValidationFailure = {
  subjectId: string;
  sectionId: string;
  questionId: string;
  errors: string[];
};

export const getQuestionValidationErrors = (question: QuestionItem, sectionType: QuestionSectionType): string[] => {
  const errors: string[] = [];

  if (!hasTextOrImage(question.text, question.image)) {
    errors.push("Add a question title or question image.");
  }

  if (question.points <= 0) {
    errors.push("Points must be greater than 0.");
  }

  if (sectionType === "objective") {
    const options = question.options ?? [];

    if (options.length !== 4) {
      errors.push("Objective questions must have exactly 4 options.");
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
    subject.questionSections.forEach((section) => {
      section.questions.forEach((question) => {
        const errors = getQuestionValidationErrors(question, section.type);

        if (errors.length > 0) {
          failures.push({
            subjectId: subject.id,
            sectionId: section.id,
            questionId: question.id,
            errors,
          });
        }
      });
    });
  });

  return failures;
};

export const getSubjectQuestionCount = (subject: SubjectItem): number =>
  subject.questionSections.reduce((count, section) => count + section.questions.length, 0);
