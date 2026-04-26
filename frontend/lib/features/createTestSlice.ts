import { createSlice } from "@reduxjs/toolkit";
import { createTestDragReducers } from "./create-test/createTestDragReducers";
import { createInitialState, createTestSteps } from "./create-test/createTestDomain";
import { createTestNavigationReducers } from "./create-test/createTestNavigationReducers";
import { createTestPublishReducers } from "./create-test/createTestPublishReducers";
import { createTestQuestionReducers } from "./create-test/createTestQuestionReducers";
import { createTestSubjectReducers } from "./create-test/createTestSubjectReducers";

const initialState: CreateTestState = createInitialState();

export const createTestSlice = createSlice({
  name: "createTestSlice",
  initialState,
  reducers: {
    ...createTestNavigationReducers,
    ...createTestSubjectReducers,
    ...createTestQuestionReducers,
    ...createTestDragReducers,
    ...createTestPublishReducers,
  },
});

export const {
  resetForm,
  addOption,
  addQuestion,
  addSubject,
  removeSubject,
  cancelDragging,
  clearPendingFocusOption,
  clearPendingFocusQuestionId,
  deleteQuestion,
  duplicateQuestion,
  finishDragging,
  goToNextStep,
  goToPreviousStep,
  moveQuestion,
  removeOption,
  selectCorrectOption,
  setActiveQuestionId,
  setActiveSubjectId,
  setFormField,
  setQuestionValidationState,
  setSingleSubject,
  shuffleOptions,
  startDragging,
  updateOptionImage,
  updateDragging,
  updateOptionText,
  updateQuestionImage,
  updateQuestionPoints,
  updateQuestionText,
  setPublishTiming,
  setPublishField,
  setTestAudience,
  addExcludedStudent,
  removeExcludedStudent,
} = createTestSlice.actions;

export default createTestSlice.reducer;
