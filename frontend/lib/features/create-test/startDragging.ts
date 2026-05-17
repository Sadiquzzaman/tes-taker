import type { PayloadAction } from "@reduxjs/toolkit";

const startDragging = (state: CreateTestState, action: PayloadAction<DragState>) => {
  state.dragState = action.payload;
  state.activeSubjectId = action.payload.subjectId;
  state.activeQuestionId = action.payload.id;
};

export default startDragging;