import { v4 as uuidv4 } from "uuid";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";
import {
  CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID,
  CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID,
  isCreateTestQuestionCreationSupported,
} from "@/utils/createTestOptions";

export const createId = () => uuidv4();

export const createOption = (text = "", image: string | null = null): QuestionOption => ({
  id: createId(),
  text,
  image,
});

export const createQuestion = (
  questionType: CreateTestQuestionCategory,
  subType: string,
): QuestionItem | null => {
  if (!isCreateTestQuestionCreationSupported(questionType, subType)) {
    return null;
  }

  if (questionType === "ungraded") {
    return {
      id: createId(),
      type: questionType,
      subType,
      text: "",
      instruction: "",
      image: null,
      points: 2,
      showValidation: false,
    };
  }

  if (questionType !== "graded") {
    return null;
  }

  return {
    id: createId(),
    type: questionType,
    subType,
    text: "",
    instruction: "",
    image: null,
    options: [],
    correctOptionId: null,
    points: 2,
    showValidation: false,
  };
};

const normalizeQuestion = (question: QuestionItem): QuestionItem => {
  const rawType = question.type as string;
  const nextType =
    rawType === "objective"
      ? "graded"
      : rawType === "essay"
        ? "ungraded"
        : question.type;
  const nextSubType =
    question.subType ??
    (nextType === "graded"
      ? CREATE_TEST_GRADED_MULTIPLE_CHOICE_SUBTYPE_ID
      : nextType === "ungraded"
        ? CREATE_TEST_UNGRADED_ESSAY_SUBTYPE_ID
        : "");

  if (nextType === "graded") {
    return {
      ...question,
      type: nextType,
      subType: nextSubType,
      options: question.options ?? [],
      correctOptionId: question.correctOptionId ?? null,
    };
  }

  return {
    ...question,
    type: nextType,
    subType: nextSubType,
    options: undefined,
    correctOptionId: undefined,
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

export const focusOption = (
  state: CreateTestState,
  subjectId: string,
  questionId: string,
  optionId: string,
) => {
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
