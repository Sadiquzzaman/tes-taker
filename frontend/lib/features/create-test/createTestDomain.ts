import { v4 as uuidv4 } from "uuid";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";
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

export const createSubjectQuestions = (existingQuestions: QuestionItem[] = []): QuestionItem[] => {
  return existingQuestions.map(normalizeQuestion);
};

export const resolveSubjectType = (questions: QuestionItem[]): SubjectItem["type"] => {
  const uniqueTypes = Array.from(new Set(questions.map((question) => question.type)));

  return uniqueTypes.length === 1 ? uniqueTypes[0] : "";
};

export const createSubject = (
  subjectOption: Pick<SubjectItem, "name" | "value" | "id">,
  existingQuestions: QuestionItem[] = [],
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

export const moveQuestionInList = (questions: QuestionItem[], questionId: string, targetIndex: number) => {
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
  questions: QuestionItem[],
  questionType: CreateTestQuestionCategory,
  questionId: string,
  targetIndex: number,
) => {
  const questionsOfType = questions.filter((question) => question.type === questionType);

  if (questionsOfType.length === 0) {
    return questions;
  }

  const reorderedQuestions = moveQuestionInList(questionsOfType, questionId, targetIndex);
  let reorderedIndex = 0;

  return questions.map((question) => {
    if (question.type !== questionType) {
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

export const findSubjectQuestion = (subjects: SubjectItem[], subjectId: string, questionId: string) => {
  const subject = findSubjectById(subjects, subjectId);
  const question = subject ? findQuestionById(subject.questions, questionId) : null;

  return { subject, question };
};

export const getSubjectQuestionsByType = (subject: SubjectItem, questionType: CreateTestQuestionCategory) =>
  subject.questions.filter((question) => question.type === questionType);

export const syncSubjectType = (subject: SubjectItem) => {
  subject.type = resolveSubjectType(subject.questions);
};

export const resetTransientState = (state: CreateTestState) => {
  state.activeQuestionId = null;
  state.pendingFocusQuestion = null;
  state.pendingFocusOption = null;
  state.dragState = null;
};

export const focusQuestion = (state: CreateTestState, subjectId: string, questionId: string) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = questionId;
  state.pendingFocusQuestion = {
    subjectId,
    questionId,
  };
  state.pendingFocusOption = null;
};

export const focusOption = (state: CreateTestState, subjectId: string, questionId: string, optionId: string) => {
  state.activeSubjectId = subjectId;
  state.activeQuestionId = questionId;
  state.pendingFocusOption = {
    subjectId,
    questionId,
    optionId,
  };
};

export const getFirstInvalidQuestion = (questions: QuestionItem[]) =>
  questions.find((question) => getQuestionValidationErrors(question).length > 0) ?? null;

export const showQuestionValidationErrors = (questions: QuestionItem[]) => {
  questions.forEach((question) => {
    question.showValidation = getQuestionValidationErrors(question).length > 0;
  });
};
