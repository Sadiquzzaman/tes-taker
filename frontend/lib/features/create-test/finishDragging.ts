import { findSubjectById, moveQuestionInList } from "./createTestDomain";

const finishDragging = (state: CreateTestState) => {
  if (!state.dragState) {
    return;
  }

  const { id, subjectId, draggedOriginalIndex, dropLineIndex } = state.dragState;
  const subject = findSubjectById(state.subjects, subjectId);

  if (!subject) {
    state.dragState = null;
    return;
  }

  if (dropLineIndex !== draggedOriginalIndex && dropLineIndex !== draggedOriginalIndex + 1) {
    const targetIndex = dropLineIndex > draggedOriginalIndex ? dropLineIndex - 1 : dropLineIndex;
    subject.questions = moveQuestionInList(subject.questions, id, targetIndex);
  }

  state.dragState = null;
};

export default finishDragging;
