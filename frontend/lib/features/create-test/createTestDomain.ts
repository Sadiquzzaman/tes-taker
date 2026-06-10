import { v4 as uuidv4 } from "uuid";
import { getPassageValidationErrors, getQuestionValidationErrors } from "@/utils/createTestValidation";
import {
  CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID,
  CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID,
  CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID,
  getCreateTestQuestionAnswerInputMode,
  getCreateTestQuestionAnswerMode,
  getCreateTestQuestionOptionRules,
  getCreateTestQuestionSupportsAlternativeAnswers,
  isCreateTestObjectiveCategory,
  isCreateTestQuestionCreationSupported,
} from "@/utils/createTestOptions";

export const createId = () => uuidv4();
export const MATCHING_ORDERING_PAIR_DELIMITER = "::";
export const isPassageQuestionItem = (question: RootQuestionItem): question is PassageQuestionItem =>
  "childQuestions" in question;

export const createOption = (text = "", image: string | null = null): QuestionOption => ({
  id: createId(),
  text,
  image,
});

const createOptionsFromTemplates = (templates: { image: string | null; text: string }[]) =>
  templates.map((template) => createOption(template.text, template.image));

const createOptionIdAnswer = (value: string[] = []): QuestionAnswer => ({
  type: "optionId",
  value,
});

export const createMatchingOrderingAnswer = (value: string[] = []): QuestionAnswer => ({
  type: "matchingOrdering",
  value,
});

export const buildMatchingOrderingAnswerValue = (matchingOptions: MatchingQuestionOptions): string[] => {
  return matchingOptions.left.reduce<string[]>((pairs, leftOption, index) => {
    const rightOption = matchingOptions.right[index];

    if (!rightOption) {
      return pairs;
    }

    pairs.push(`${leftOption.id}${MATCHING_ORDERING_PAIR_DELIMITER}${rightOption.id}`);
    return pairs;
  }, []);
};

const createTextAnswer = (supportsAlternativeAnswers: boolean, value: string[] = []): QuestionAnswer => {
  const primaryValue = value[0] ?? "";

  if (!supportsAlternativeAnswers) {
    return {
      type: "text",
      value: [primaryValue],
    };
  }

  return {
    type: "text",
    value: [primaryValue, primaryValue.trim() ? (value[1] ?? "") : ""],
  };
};

const createQuestionAnswer = (
  questionType: CreateTestQuestionCategory,
  subType: string,
): QuestionAnswer | undefined => {
  const answerMode = getCreateTestQuestionAnswerMode(questionType, subType);
  const answerInputMode = getCreateTestQuestionAnswerInputMode(questionType, subType);
  const supportsAlternativeAnswers = getCreateTestQuestionSupportsAlternativeAnswers(questionType, subType);

  if (isCreateTestObjectiveCategory(questionType) && subType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID) {
    return createMatchingOrderingAnswer();
  }

  if (answerInputMode === "correct-answer") {
    return createTextAnswer(supportsAlternativeAnswers, supportsAlternativeAnswers ? ["", ""] : [""]);
  }

  if (isCreateTestObjectiveCategory(questionType) && answerMode !== "none") {
    return createOptionIdAnswer();
  }

  return undefined;
};

const normalizeTextAnswer = (question: LegacyQuestionItem, supportsAlternativeAnswers: boolean): QuestionAnswer => {
  const sourceValues =
    question.answer?.type === "text"
      ? question.answer.value
      : supportsAlternativeAnswers
        ? [question.correctAns ?? "", question.alternativeAnser?.[0] ?? ""]
        : [question.correctAns ?? ""];

  return createTextAnswer(supportsAlternativeAnswers, sourceValues);
};

const normalizeOptionIdAnswer = (
  question: LegacyQuestionItem,
  answerMode: CreateTestQuestionAnswerMode,
  validOptionIds: Set<string>,
): QuestionAnswer => {
  const sourceValues =
    question.answer?.type === "optionId"
      ? question.answer.value
      : answerMode === "multiple"
        ? (question.correctOptionIds ?? [])
        : question.correctOptionId
          ? [question.correctOptionId]
          : [];
  const nextValues = sourceValues.filter((optionId) => validOptionIds.has(optionId));

  if (answerMode === "multiple") {
    return createOptionIdAnswer(nextValues);
  }

  return createOptionIdAnswer(nextValues.length > 0 ? [nextValues[0]] : []);
};

export const createQuestion = (questionType: CreateTestQuestionCategory, subType: string): QuestionItem | null => {
  if (!isCreateTestQuestionCreationSupported(questionType, subType)) {
    return null;
  }

  const optionRules = getCreateTestQuestionOptionRules(questionType, subType);
  const answer = createQuestionAnswer(questionType, subType);

  if (questionType === "ungraded") {
    return {
      id: createId(),
      type: questionType,
      subType,
      text: "",
      instruction: "",
      image: null,
      answer,
      points: 2,
      showValidation: false,
    };
  }

  if (!isCreateTestObjectiveCategory(questionType)) {
    return null;
  }

  if (subType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID) {
    return {
      id: createId(),
      type: questionType,
      subType,
      text: "",
      instruction: "",
      image: null,
      matchingOptions: {
        left: [],
        right: [],
      },
      answer,
      options: undefined,
      points: 2,
      showValidation: false,
    };
  }

  const nextQuestion: QuestionItem = {
    id: createId(),
    type: questionType,
    subType,
    text: "",
    instruction: "",
    image: null,
    answer,
    options: optionRules
      ? optionRules.useFixedOptions
        ? createOptionsFromTemplates(optionRules.fixedOptions)
        : []
      : [],
    points: 2,
    showValidation: false,
  };

  return nextQuestion;
};

export const createPassageQuestion = (subType: string): PassageQuestionItem | null => {
  const childQuestion = createQuestion("passage-question", subType);

  if (!childQuestion) {
    return null;
  }

  return {
    id: createId(),
    type: "passage-question",
    passageText: "",
    childQuestions: [childQuestion],
    showValidation: false,
  };
};

const normalizeMatchingOptions = (question: QuestionItem): MatchingQuestionOptions => ({
  left: (question.matchingOptions?.left ?? []).map((option) => ({
    ...option,
    image: null,
  })),
  right: (question.matchingOptions?.right ?? []).map((option) => ({
    ...option,
    image: null,
  })),
});

const normalizeFixedOptions = (question: QuestionItem, subType: string, questionType: CreateTestQuestionCategory) => {
  const optionRules = getCreateTestQuestionOptionRules(questionType, subType);

  if (!optionRules?.useFixedOptions) {
    return question.options ?? [];
  }

  return optionRules.fixedOptions.map((template, index) => {
    const existingOption = question.options?.[index];

    return {
      id: existingOption?.id ?? createId(),
      text: template.text,
      image: template.image,
    };
  });
};

const normalizeQuestion = (question: QuestionItem): QuestionItem => {
  const legacyQuestion = question as LegacyQuestionItem;
  const rawType = question.type as string;
  const nextType = rawType === "objective" ? "graded" : rawType === "essay" ? "ungraded" : question.type;
  const nextSubType =
    question.subType ??
    (nextType === "graded"
      ? CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID
      : nextType === "ungraded"
        ? CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID
        : "");
  const answerMode = getCreateTestQuestionAnswerMode(nextType, nextSubType);
  const answerInputMode = getCreateTestQuestionAnswerInputMode(nextType, nextSubType);
  const supportsAlternativeAnswers = getCreateTestQuestionSupportsAlternativeAnswers(nextType, nextSubType);
  const optionRules = getCreateTestQuestionOptionRules(nextType, nextSubType);

  if (isCreateTestObjectiveCategory(nextType) && nextSubType === CREATE_TEST_GRADED_MATCHING_ORDERING_SUBTYPE_ID) {
    const matchingOptions = normalizeMatchingOptions(question);
    const answer =
      question.answer?.type === "matchingOrdering"
        ? createMatchingOrderingAnswer(question.answer.value)
        : createMatchingOrderingAnswer(buildMatchingOrderingAnswerValue(matchingOptions));

    return {
      ...question,
      type: nextType,
      subType: nextSubType,
      matchingOptions,
      options: undefined,
      answer,
    };
  }

  if (isCreateTestObjectiveCategory(nextType) && optionRules) {
    const options = optionRules.useFixedOptions
      ? normalizeFixedOptions(question, nextSubType, nextType)
      : (question.options ?? []);
    const validOptionIds = new Set(options.map((option) => option.id));
    const answer = normalizeOptionIdAnswer(legacyQuestion, answerMode, validOptionIds);

    return {
      ...question,
      type: nextType,
      subType: nextSubType,
      matchingOptions: undefined,
      options,
      answer,
    };
  }

  if (answerInputMode === "correct-answer") {
    return {
      ...question,
      type: nextType,
      subType: nextSubType,
      matchingOptions: undefined,
      options: undefined,
      answer: normalizeTextAnswer(legacyQuestion, supportsAlternativeAnswers),
    };
  }

  return {
    ...question,
    type: nextType,
    subType: nextSubType,
    matchingOptions: undefined,
    options: undefined,
    answer: undefined,
  };
};

const normalizeRootQuestion = (question: RootQuestionItem): RootQuestionItem => {
  if (!isPassageQuestionItem(question)) {
    return normalizeQuestion(question);
  }

  return {
    ...question,
    passageText: question.passageText ?? "",
    childQuestions: question.childQuestions.map((childQuestion) => normalizeQuestion(childQuestion)),
  };
};

export const createSubjectQuestions = (existingQuestions: RootQuestionItem[] = []): RootQuestionItem[] => {
  return existingQuestions.map(normalizeRootQuestion);
};

export const resolveSubjectType = (questions: RootQuestionItem[]): SubjectItem["type"] => {
  const uniqueTypes = Array.from(
    new Set(
      questions.map((question) => {
        if (isPassageQuestionItem(question)) {
          return "passage-question";
        }

        return question.type;
      }),
    ),
  );

  return uniqueTypes.length === 1 ? uniqueTypes[0] : "";
};

export const createSubject = (
  subjectOption: Pick<SubjectItem, "name" | "value" | "id">,
  existingQuestions: RootQuestionItem[] = [],
): SubjectItem => {
  const questions = createSubjectQuestions(existingQuestions);

  return {
    id: subjectOption.id,
    name: subjectOption.name,
    value: subjectOption.value,
    type: resolveSubjectType(questions),
    questions,
  };
};

export const moveQuestionInList = (questions: RootQuestionItem[], questionId: string, targetIndex: number) => {
  const currentIndex = questions.findIndex((question) => question.id === questionId);

  if (currentIndex === -1) {
    return questions;
  }

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, questions.length - 1));

  if (currentIndex === boundedTargetIndex) {
    return questions;
  }

  const nextQuestions = [...questions];
  const [movedQuestion] = nextQuestions.splice(currentIndex, 1);
  nextQuestions.splice(boundedTargetIndex, 0, movedQuestion);

  return nextQuestions;
};

export const reorderQuestionsByType = (
  questions: RootQuestionItem[],
  questionType: CreateTestQuestionCategory,
  questionId: string,
  targetIndex: number,
) => {
  const questionsOfType = questions.filter(
    (question) => !isPassageQuestionItem(question) && question.type === questionType,
  );

  if (questionsOfType.length === 0) {
    return questions;
  }

  const reorderedQuestions = moveQuestionInList(questionsOfType, questionId, targetIndex);
  let reorderedIndex = 0;

  return questions.map((question) => {
    if (isPassageQuestionItem(question) || question.type !== questionType) {
      return question;
    }

    const reorderedQuestion = reorderedQuestions[reorderedIndex];
    reorderedIndex += 1;
    return reorderedQuestion;
  });
};

export const findSubjectById = (subjects: SubjectItem[], subjectId: string) =>
  subjects.find((subject) => subject.id === subjectId) ?? null;

export const findQuestionById = (questions: QuestionItem[], questionId: string) =>
  questions.find((question) => question.id === questionId) ?? null;

export const findPassageById = (questions: RootQuestionItem[], passageId: string) => {
  const rootQuestion = questions.find((question) => question.id === passageId);

  if (!rootQuestion || !isPassageQuestionItem(rootQuestion)) {
    return null;
  }

  return rootQuestion;
};

export const findSubjectQuestion = (
  subjects: SubjectItem[],
  subjectId: string,
  questionId: string,
  parentPassageId?: string | null,
) => {
  const subject = findSubjectById(subjects, subjectId);
  if (!subject) {
    return { parentPassage: null, question: null, subject: null };
  }

  if (parentPassageId) {
    const parentPassage = findPassageById(subject.questions, parentPassageId);
    const question = parentPassage ? findQuestionById(parentPassage.childQuestions, questionId) : null;

    return { parentPassage, question, subject };
  }

  for (const rootQuestion of subject.questions) {
    if (isPassageQuestionItem(rootQuestion)) {
      const nestedQuestion = findQuestionById(rootQuestion.childQuestions, questionId);

      if (nestedQuestion) {
        return {
          parentPassage: rootQuestion,
          question: nestedQuestion,
          subject,
        };
      }

      continue;
    }

    if (rootQuestion.id === questionId) {
      return {
        parentPassage: null,
        question: rootQuestion,
        subject,
      };
    }
  }

  return { parentPassage: null, question: null, subject };
};

export const getSubjectQuestionsByType = (subject: SubjectItem, questionType: CreateTestQuestionCategory) =>
  subject.questions.filter((question) => !isPassageQuestionItem(question) && question.type === questionType);

export const getSubjectQuestionCount = (subject: SubjectItem): number =>
  subject.questions.reduce((questionCount, question) => {
    if (isPassageQuestionItem(question)) {
      return questionCount + question.childQuestions.length;
    }

    return questionCount + 1;
  }, 0);

export const getSubjectTotalMarks = (subject: SubjectItem): number =>
  subject.questions.reduce((totalMarks, question) => {
    if (isPassageQuestionItem(question)) {
      return (
        totalMarks + question.childQuestions.reduce((childTotal, childQuestion) => childTotal + childQuestion.points, 0)
      );
    }

    return totalMarks + question.points;
  }, 0);

export const syncSubjectType = (subject: SubjectItem) => {
  subject.type = resolveSubjectType(subject.questions);
};

export const resetTransientState = (state: CreateTestState) => {
  state.activeQuestionId = null;
  state.activePassageId = null;
  state.pendingFocusQuestion = null;
  state.pendingFocusOption = null;
  state.dragState = null;
};

export const focusPassage = (state: CreateTestState, subjectId: string, passageId: string) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = null;
  state.activePassageId = passageId;
  state.pendingFocusQuestion = {
    subjectId,
    questionId: null,
    parentPassageId: passageId,
  };
  state.pendingFocusOption = null;
};

export const focusQuestion = (
  state: CreateTestState,
  subjectId: string,
  questionId: string,
  parentPassageId?: string | null,
) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = questionId;
  state.activePassageId = parentPassageId ?? null;
  state.pendingFocusQuestion = {
    subjectId,
    questionId,
    parentPassageId: parentPassageId ?? null,
  };
  state.pendingFocusOption = null;
};

export const focusOption = (
  state: CreateTestState,
  subjectId: string,
  questionId: string,
  optionId: string,
  parentPassageId?: string | null,
) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = questionId;
  state.activePassageId = parentPassageId ?? null;
  state.pendingFocusOption = {
    subjectId,
    questionId,
    optionId,
    parentPassageId: parentPassageId ?? null,
  };
};

export const getFirstInvalidQuestion = (
  subjectId: string,
  questions: RootQuestionItem[],
): InvalidQuestionPayload | null => {
  for (const question of questions) {
    if (isPassageQuestionItem(question)) {
      if (getPassageValidationErrors(question).length > 0) {
        return {
          subjectId,
          questionId: question.id,
          parentPassageId: question.id,
          targetType: "passage",
        };
      }

      const invalidChildQuestion = question.childQuestions.find(
        (childQuestion) => getQuestionValidationErrors(childQuestion).length > 0,
      );

      if (invalidChildQuestion) {
        return {
          subjectId,
          questionId: invalidChildQuestion.id,
          parentPassageId: question.id,
          targetType: "question",
        };
      }

      continue;
    }

    if (getQuestionValidationErrors(question).length > 0) {
      return {
        subjectId,
        questionId: question.id,
        targetType: "question",
      };
    }
  }

  return null;
};

export const showQuestionValidationErrors = (questions: RootQuestionItem[]) => {
  questions.forEach((question) => {
    if (isPassageQuestionItem(question)) {
      question.showValidation = getPassageValidationErrors(question).length > 0;
      question.childQuestions.forEach((childQuestion) => {
        childQuestion.showValidation = getQuestionValidationErrors(childQuestion).length > 0;
      });
      return;
    }

    question.showValidation = getQuestionValidationErrors(question).length > 0;
  });
};
