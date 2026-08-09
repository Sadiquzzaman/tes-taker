import type { PayloadAction } from "@reduxjs/toolkit";
import {
  createSubject,
  findSubjectById,
  focusQuestion,
  isPassageQuestionItem,
  syncSubjectType,
} from "./createTestDomain";

const syncQuestionOrder = (state: CreateTestState) => {
  const flatIds = state.subjects.flatMap((subject) => subject.questions.map((question) => question.id));
  const remaining = new Set(flatIds);
  const nextOrder = state.questionOrder.filter((id) => {
    if (!remaining.has(id)) {
      return false;
    }
    remaining.delete(id);
    return true;
  });
  state.questionOrder = [...nextOrder, ...remaining];
};

const moveQuestionToSubject = (
  state: CreateTestState,
  action: PayloadAction<{
    sourceSubjectId: string;
    targetSubject: SubjectSelectionPayload;
    questionId: string;
  }>,
) => {
  const { sourceSubjectId, targetSubject, questionId } = action.payload;
  const source = findSubjectById(state.subjects, sourceSubjectId);

  if (!source) {
    return;
  }

  const questionIndex = source.questions.findIndex((question) => question.id === questionId);
  if (questionIndex === -1) {
    return;
  }

  if (sourceSubjectId === targetSubject.id) {
    return;
  }

  const [question] = source.questions.splice(questionIndex, 1);
  if ("subjectId" in question || isPassageQuestionItem(question)) {
    (question as QuestionItem | PassageQuestionItem).subjectId = targetSubject.id;
  }
  syncSubjectType(source);

  let target = findSubjectById(state.subjects, targetSubject.id);
  if (!target) {
    target = createSubject({
      id: targetSubject.id,
      name: targetSubject.label,
      value: targetSubject.value,
    });
    state.subjects.push(target);
  }

  target.questions.push(question);
  syncSubjectType(target);

  if (source.questions.length === 0) {
    state.subjects = state.subjects.filter((subject) => subject.id !== source.id);
  }

  state.activeSubjectId = target.id;
  if (isPassageQuestionItem(question)) {
    state.activePassageId = question.id;
    state.activeQuestionId = question.childQuestions[0]?.id ?? null;
  } else {
    focusQuestion(state, target.id, question.id);
  }

  syncQuestionOrder(state);
};

export default moveQuestionToSubject;
export { syncQuestionOrder };
