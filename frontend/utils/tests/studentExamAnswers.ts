export const createInitialExamAnswerState = (exam: StudentExamDetails): ExamAnswerState => {
  return exam.subjects.reduce<ExamAnswerState>((answerState, subject) => {
    subject.questions.forEach((question) => {
      if (question.type === "passage-question") {
        question.childQuestions.forEach((childQuestion) => {
          answerState[childQuestion.id] = [];
        });
        return;
      }

      answerState[question.id] = question.type === "ungraded" ? "" : [];
    });

    return answerState;
  }, {});
};

export const toggleMultiSelectAnswer = (currentValue: ExamAnswerValue | undefined, optionId: string): string[] => {
  const selectedOptionIds = Array.isArray(currentValue) ? currentValue : [];

  if (selectedOptionIds.includes(optionId)) {
    return selectedOptionIds.filter((selectedOptionId) => selectedOptionId !== optionId);
  }

  return [...selectedOptionIds, optionId];
};

export const buildMatchingAnswerPairs = (
  leftOptions: StudentExamMatchingOption[],
  orderedRightOptions: StudentExamMatchingOption[],
): string[] => {
  return leftOptions.reduce<string[]>((pairs, leftOption, index) => {
    const rightOption = orderedRightOptions[index];

    if (!rightOption) {
      return pairs;
    }

    pairs.push(`${leftOption.id}::${rightOption.id}`);
    return pairs;
  }, []);
};

export const getMatchingRightOptionOrder = (
  currentValue: ExamAnswerValue | undefined,
  leftOptions: StudentExamMatchingOption[],
  rightOptions: StudentExamMatchingOption[],
): StudentExamMatchingOption[] => {
  if (!Array.isArray(currentValue) || currentValue.length !== leftOptions.length) {
    return rightOptions;
  }

  const rightOptionMap = new Map(rightOptions.map((option) => [option.id, option]));
  const orderedRightOptions = leftOptions
    .map((leftOption) => {
      const matchingPair = currentValue.find((pair) => pair.startsWith(`${leftOption.id}::`));

      if (!matchingPair) {
        return null;
      }

      const rightOptionId = matchingPair.split("::")[1];
      return rightOptionMap.get(rightOptionId) ?? null;
    })
    .filter((option): option is StudentExamMatchingOption => Boolean(option));

  if (orderedRightOptions.length !== rightOptions.length) {
    return rightOptions;
  }

  return orderedRightOptions;
};
