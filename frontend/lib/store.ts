import { configureStore } from "@reduxjs/toolkit";
import { classSlice } from "./features/classSlice";
import { subjectSlice } from "./features/subjectSlice";
import { testSlice } from "./features/testSlice";
import { gradingSlice } from "./features/gradingSlice";
import { gradeDetailsSlice } from "./features/gradeDetailsSlice";
import { createTestSlice } from "./features/createTestSlice";
import { proctoringSlice } from "./features/proctoringSlice";
import { studentExamAnswerSlice } from "./features/studentExamAnswerSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      class: classSlice.reducer,
      subject: subjectSlice.reducer,
      test: testSlice.reducer,
      grade: gradingSlice.reducer,
      gradeDetails: gradeDetailsSlice.reducer,
      createTest: createTestSlice.reducer,
      proctoring: proctoringSlice.reducer,
      studentExamAnswer: studentExamAnswerSlice.reducer,
    },
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
