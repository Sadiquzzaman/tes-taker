import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";

const initialState: ExamAnswerSliceState = {
  examId: null,
  values: {},
};

export const studentExamAnswerSlice = createSlice({
  name: "studentExamAnswerSlice",
  initialState,
  reducers: {
    initializeExamAnswers: (state, action: PayloadAction<InitializeExamAnswersPayload>) => {
      if (state.examId !== action.payload.examId) {
        state.examId = action.payload.examId;
        state.values = action.payload.values;
        return;
      }

      Object.entries(action.payload.values).forEach(([questionId, value]) => {
        if (!(questionId in state.values)) {
          state.values[questionId] = value;
        }
      });
    },
    setExamAnswerValue: (state, action: PayloadAction<SetExamAnswerValuePayload>) => {
      state.values[action.payload.questionId] = action.payload.value;
    },
    resetExamAnswers: () => initialState,
  },
});

export const { initializeExamAnswers, setExamAnswerValue, resetExamAnswers } = studentExamAnswerSlice.actions;

export const selectExamAnswerState = (state: RootState) => state.studentExamAnswer.values;

export default studentExamAnswerSlice.reducer;
