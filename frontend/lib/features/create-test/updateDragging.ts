import type { PayloadAction } from "@reduxjs/toolkit";

const updateDragging = (
  state: CreateTestState,
  action: PayloadAction<Pick<DragState, "pointerX" | "pointerY" | "dropLineIndex">>,
) => {
  if (!state.dragState) {
    return;
  }

  state.dragState.pointerX = action.payload.pointerX;
  state.dragState.pointerY = action.payload.pointerY;
  state.dragState.dropLineIndex = action.payload.dropLineIndex;
};

export default updateDragging;