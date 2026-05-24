import { v4 as uuidv4 } from "uuid";
import { getQuestionValidationErrors } from "@/utils/createTestValidation";

export const createId = () => uuidv4();

const defaultQuestionTypes: QuestionSectionType[] = ["objective", "essay"];

export const createOption = (text = "", image: string | null = null): QuestionOption => ({
  id: createId(),
  text,
  image,
});

export const createQuestion = (questionType: QuestionSectionType): QuestionItem => {
  if (questionType === "essay") {
    return {
      id: createId(),
      type: questionType,
      subType: "",
      text: "",
      instruction: "",
      image: null,
      points: 2,
      showValidation: false,
    };
  }

  return {
    id: createId(),
    type: questionType,
    subType: "",
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
  if (question.type === "objective") {
    return {
      ...question,
      subType: question.subType ?? "",
      options: question.options ?? [],
      correctOptionId: question.correctOptionId ?? null,
    };
  }

  return {
    ...question,
    subType: question.subType ?? "",
  };
};

export const createSubjectQuestions = (existingQuestions: QuestionItem[] = []): QuestionItem[] => {
  if (existingQuestions.length > 0) {
    return existingQuestions.map(normalizeQuestion);
  }

  return defaultQuestionTypes.map((questionType) => createQuestion(questionType));
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
  questionType: QuestionSectionType,
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

export const getSubjectQuestionsByType = (subject: SubjectItem, questionType: QuestionSectionType) =>
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
  questions.find((question) => getQuestionValidationErrors(question, question.type).length > 0) ?? null;

export const showQuestionValidationErrors = (questions: QuestionItem[]) => {
  questions.forEach((question) => {
    question.showValidation = getQuestionValidationErrors(question, question.type).length > 0;
  });
};
