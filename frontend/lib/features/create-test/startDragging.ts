import type { PayloadAction } from "@reduxjs/toolkit";

const startDragging = (state: CreateTestState, action: PayloadAction<DragState>) => {
  state.dragState = action.payload;
  state.activeSubjectId = action.payload.subjectId;
};

export default startDragging;
