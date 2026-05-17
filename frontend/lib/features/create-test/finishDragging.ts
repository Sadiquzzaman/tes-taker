import { findSubjectSection, moveQuestionInList } from "./createTestDomain";

const finishDragging = (state: CreateTestState) => {
  if (!state.dragState) {
    return;
  }

  const { id, subjectId, sectionId, draggedOriginalIndex, dropLineIndex } = state.dragState;
  const { section } = findSubjectSection(state.subjects, subjectId, sectionId);

  if (!section) {
    state.dragState = null;
    return;
  }

  if (dropLineIndex !== draggedOriginalIndex && dropLineIndex !== draggedOriginalIndex + 1) {
    const targetIndex = dropLineIndex > draggedOriginalIndex ? dropLineIndex - 1 : dropLineIndex;
    section.questions = moveQuestionInList(section.questions, id, targetIndex);
  }

  state.dragState = null;
};

export default finishDragging;