import { createSlice } from "@reduxjs/toolkit";
import addExcludedStudentReducer from "./create-test/addExcludedStudent";
import addMatchingPairReducer from "./create-test/addMatchingPair";
import addOptionReducer from "./create-test/addOption";
import addQuestionReducer from "./create-test/addQuestion";
import addSubjectReducer from "./create-test/addSubject";
import applyGlobalQuestionOrderReducer, {
  moveGlobalQuestion as moveGlobalQuestionReducer,
} from "./create-test/applyGlobalQuestionOrder";
import applyParsedQuestionReducer from "./create-test/applyParsedQuestion";
import applySpokenQuestionReducer from "./create-test/applySpokenQuestion";
import changeQuestionSubtypeReducer from "./create-test/changeQuestionSubtype";
import cancelDraggingReducer from "./create-test/cancelDragging";
import clearPendingFocusOptionReducer from "./create-test/clearPendingFocusOption";
import clearPendingFocusQuestionIdReducer from "./create-test/clearPendingFocusQuestionId";
import createInitialState from "./create-test/createInitialState";
import deleteQuestionReducer from "./create-test/deleteQuestion";
import duplicateQuestionReducer from "./create-test/duplicateQuestion";
import finishDraggingReducer from "./create-test/finishDragging";
import goToNextStepReducer from "./create-test/goToNextStep";
import goToPreviousStepReducer from "./create-test/goToPreviousStep";
import hydrateFromExamReducer from "./create-test/hydrateFromExam";
import moveQuestionReducer from "./create-test/moveQuestion";
import moveQuestionToSubjectReducer from "./create-test/moveQuestionToSubject";
import removeExcludedStudentReducer from "./create-test/removeExcludedStudent";
import removeMatchingPairReducer from "./create-test/removeMatchingPair";
import removeOptionReducer from "./create-test/removeOption";
import removeSubjectReducer from "./create-test/removeSubject";
import resetFormReducer from "./create-test/resetForm";
import selectCorrectOptionReducer from "./create-test/selectCorrectOption";
import setActiveQuestionIdReducer from "./create-test/setActiveQuestionId";
import setActiveSubjectIdReducer from "./create-test/setActiveSubjectId";
import setCurrentStepReducer from "./create-test/setCurrentStep";
import setFormFieldReducer from "./create-test/setFormField";
import setPublishFieldReducer from "./create-test/setPublishField";
import setPublishTimingReducer from "./create-test/setPublishTiming";
import setQuestionValidationStateReducer from "./create-test/setQuestionValidationState";
import setSingleSubjectReducer from "./create-test/setSingleSubject";
import setTestAudienceReducer from "./create-test/setTestAudience";
import shuffleOptionsReducer from "./create-test/shuffleOptions";
import startDraggingReducer from "./create-test/startDragging";
import updateDraggingReducer from "./create-test/updateDragging";
import updateMatchingOptionTextReducer from "./create-test/updateMatchingOptionText";
import updateOptionImageReducer from "./create-test/updateOptionImage";
import updateOptionTextReducer from "./create-test/updateOptionText";
import updatePassageTextReducer from "./create-test/updatePassageText";
import updateQuestionAnswerValueReducer from "./create-test/updateQuestionAnswerValue";
import updateQuestionImageReducer from "./create-test/updateQuestionImage";
import updateQuestionInstructionReducer from "./create-test/updateQuestionInstruction";
import updateQuestionPointsReducer from "./create-test/updateQuestionPoints";
import updateQuestionTextReducer from "./create-test/updateQuestionText";
import { syncQuestionOrder } from "./create-test/moveQuestionToSubject";

const initialState: CreateTestState = createInitialState();

const withQuestionOrderSync =
  <A>(reducer: (state: CreateTestState, action: A) => void) =>
  (state: CreateTestState, action: A) => {
    reducer(state, action);
    syncQuestionOrder(state);
  };

export const createTestSlice = createSlice({
  name: "createTestSlice",
  initialState,
  reducers: {
    resetForm: resetFormReducer,
    hydrateFromExam: hydrateFromExamReducer,
    goToNextStep: goToNextStepReducer,
    goToPreviousStep: goToPreviousStepReducer,
    setCurrentStep: setCurrentStepReducer,
    changeQuestionSubtype: changeQuestionSubtypeReducer,
    setFormField: setFormFieldReducer,
    setSingleSubject: withQuestionOrderSync(setSingleSubjectReducer),
    addMatchingPair: addMatchingPairReducer,
    addSubject: withQuestionOrderSync(addSubjectReducer),
    removeSubject: withQuestionOrderSync(removeSubjectReducer),
    setActiveSubjectId: setActiveSubjectIdReducer,
    addQuestion: withQuestionOrderSync(addQuestionReducer),
    applyParsedQuestion: withQuestionOrderSync(applyParsedQuestionReducer),
    applySpokenQuestion: withQuestionOrderSync(applySpokenQuestionReducer),
    deleteQuestion: withQuestionOrderSync(deleteQuestionReducer),
    duplicateQuestion: withQuestionOrderSync(duplicateQuestionReducer),
    shuffleOptions: shuffleOptionsReducer,
    updateQuestionText: updateQuestionTextReducer,
    updateQuestionInstruction: updateQuestionInstructionReducer,
    updateQuestionAnswerValue: updateQuestionAnswerValueReducer,
    updateQuestionImage: updateQuestionImageReducer,
    updatePassageText: updatePassageTextReducer,
    updateMatchingOptionText: updateMatchingOptionTextReducer,
    updateOptionText: updateOptionTextReducer,
    updateOptionImage: updateOptionImageReducer,
    selectCorrectOption: selectCorrectOptionReducer,
    removeMatchingPair: removeMatchingPairReducer,
    removeOption: removeOptionReducer,
    addOption: addOptionReducer,
    updateQuestionPoints: updateQuestionPointsReducer,
    setQuestionValidationState: setQuestionValidationStateReducer,
    moveQuestion: withQuestionOrderSync(moveQuestionReducer),
    moveQuestionToSubject: moveQuestionToSubjectReducer,
    applyGlobalQuestionOrder: applyGlobalQuestionOrderReducer,
    moveGlobalQuestion: moveGlobalQuestionReducer,
    setActiveQuestionId: setActiveQuestionIdReducer,
    clearPendingFocusQuestionId: clearPendingFocusQuestionIdReducer,
    clearPendingFocusOption: clearPendingFocusOptionReducer,
    startDragging: startDraggingReducer,
    updateDragging: updateDraggingReducer,
    finishDragging: (state) => {
      finishDraggingReducer(state);
      syncQuestionOrder(state);
    },
    cancelDragging: cancelDraggingReducer,
    setPublishTiming: setPublishTimingReducer,
    setPublishField: setPublishFieldReducer,
    setTestAudience: setTestAudienceReducer,
    addExcludedStudent: addExcludedStudentReducer,
    removeExcludedStudent: removeExcludedStudentReducer,
  },
});

export const {
  resetForm,
  hydrateFromExam,
  addMatchingPair,
  addOption,
  addQuestion,
  applySpokenQuestion,
  applyParsedQuestion,
  changeQuestionSubtype,
  setCurrentStep,
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
  moveQuestionToSubject,
  applyGlobalQuestionOrder,
  moveGlobalQuestion,
  removeMatchingPair,
  removeOption,
  selectCorrectOption,
  setActiveQuestionId,
  setActiveSubjectId,
  setFormField,
  setQuestionValidationState,
  setSingleSubject,
  shuffleOptions,
  startDragging,
  updateMatchingOptionText,
  updateOptionImage,
  updateDragging,
  updateOptionText,
  updateQuestionAnswerValue,
  updateQuestionImage,
  updatePassageText,
  updateQuestionPoints,
  updateQuestionText,
  setPublishTiming,
  setPublishField,
  setTestAudience,
  addExcludedStudent,
  removeExcludedStudent,
  updateQuestionInstruction,
} = createTestSlice.actions;

export default createTestSlice.reducer;
