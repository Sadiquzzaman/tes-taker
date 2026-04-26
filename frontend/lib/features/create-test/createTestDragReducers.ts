import type { PayloadAction } from "@reduxjs/toolkit";
import { findSubjectSection, moveQuestionInList } from "./createTestDomain";

export const createTestDragReducers = {
  startDragging: (state: CreateTestState, action: PayloadAction<DragState>) => {
    state.dragState = action.payload;
    state.activeSubjectId = action.payload.subjectId;
    state.activeQuestionId = action.payload.id;
  },
  updateDragging: (
    state: CreateTestState,
    action: PayloadAction<Pick<DragState, "pointerX" | "pointerY" | "dropLineIndex">>,
  ) => {
    if (!state.dragState) {
      return;
    }

    state.dragState.pointerX = action.payload.pointerX;
    state.dragState.pointerY = action.payload.pointerY;
    state.dragState.dropLineIndex = action.payload.dropLineIndex;
  },
  finishDragging: (state: CreateTestState) => {
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
  },
  cancelDragging: (state: CreateTestState) => {
    state.dragState = null;
  },
};