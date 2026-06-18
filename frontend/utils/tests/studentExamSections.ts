const createQuestionFromPrompt = (
  question: StudentExamStandardQuestion | StudentExamPassageChildQuestion,
  instructionPrefix?: string,
): StudentExamQuestion => ({
  id: question.id,
  text: question.text ?? "",
  image: question.image ?? null,
  options: question.options,
  points: question.points ?? 0,
  instruction: instructionPrefix
    ? [instructionPrefix, question.instruction].filter(Boolean).join("\n\n")
    : (question.instruction ?? null),
  showValidation: question.showValidation,
  correctOptionId: question.correctOptionId,
});

const pushQuestionByInputType = (
  question: StudentExamQuestion,
  objectiveQuestions: StudentExamQuestion[],
  essayQuestions: StudentExamQuestion[],
) => {
  if (question.options?.length) {
    objectiveQuestions.push(question);
    return;
  }

  essayQuestions.push(question);
};

export const buildStudentExamQuestionSections = (subject: StudentExamSubject): StudentExamQuestionSection[] => {
  const objectiveQuestions: StudentExamQuestion[] = [];
  const essayQuestions: StudentExamQuestion[] = [];

  subject.questions.forEach((question) => {
    if (question.type === "passage-question") {
      if (question.childQuestions?.length) {
        question.childQuestions.forEach((childQuestion) => {
          const passageInstruction = question.passageText ? `Passage:\n${question.passageText}` : undefined;
          pushQuestionByInputType(
            createQuestionFromPrompt(childQuestion, passageInstruction),
            objectiveQuestions,
            essayQuestions,
          );
        });
      }

      return;
    }

    pushQuestionByInputType(createQuestionFromPrompt(question), objectiveQuestions, essayQuestions);
  });

  const sections: StudentExamQuestionSection[] = [];

  if (objectiveQuestions.length) {
    sections.push({
      id: `${subject.id}-objective`,
      type: "objective",
      headerText: subject.name,
      questions: objectiveQuestions,
    });
  }

  if (essayQuestions.length) {
    sections.push({
      id: `${subject.id}-essay`,
      type: "essay",
      headerText: subject.name,
      questions: essayQuestions,
    });
  }

  return sections;
};
