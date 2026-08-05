import type { PayloadAction } from "@reduxjs/toolkit";
import { moveQuestionInList } from "./createTestDomain";
import { syncQuestionOrder } from "./moveQuestionToSubject";

const rebuildSubjectsFromOrder = (state: CreateTestState, orderedIds: string[]) => {
  const questionById = new Map<string, { subjectId: string; question: RootQuestionItem }>();

  for (const subject of state.subjects) {
    for (const question of subject.questions) {
      questionById.set(question.id, { subjectId: subject.id, question });
    }
  }

  const nextQuestionsBySubject = new Map<string, RootQuestionItem[]>();
  for (const subject of state.subjects) {
    nextQuestionsBySubject.set(subject.id, []);
  }

  for (const id of orderedIds) {
    const entry = questionById.get(id);
    if (!entry) {
      continue;
    }
    const list = nextQuestionsBySubject.get(entry.subjectId) ?? [];
    list.push(entry.question);
    nextQuestionsBySubject.set(entry.subjectId, list);
  }

  state.subjects = state.subjects.map((subject) => ({
    ...subject,
    questions: nextQuestionsBySubject.get(subject.id) ?? [],
  }));

  state.questionOrder = orderedIds.filter((id) => questionById.has(id));
  syncQuestionOrder(state);
};

/**
 * Reorder root questions exam-wide. Rebuilds each subject's question list
 * while preserving subject membership, and stores the global order.
 */
const applyGlobalQuestionOrder = (state: CreateTestState, action: PayloadAction<{ orderedIds: string[] }>) => {
  rebuildSubjectsFromOrder(state, action.payload.orderedIds);
};

/** Move a root question within the global order list (Reorder step DnD). */
const moveGlobalQuestion = (
  state: CreateTestState,
  action: PayloadAction<{ questionId: string; targetIndex: number }>,
) => {
  const flatIds =
    state.questionOrder.length > 0
      ? [...state.questionOrder]
      : state.subjects.flatMap((subject) => subject.questions.map((question) => question.id));

  const asQuestions = flatIds.map((id) => ({ id })) as RootQuestionItem[];
  const reordered = moveQuestionInList(asQuestions, action.payload.questionId, action.payload.targetIndex);
  rebuildSubjectsFromOrder(
    state,
    reordered.map((item) => item.id),
  );
};

export { applyGlobalQuestionOrder, moveGlobalQuestion };
export default applyGlobalQuestionOrder;
