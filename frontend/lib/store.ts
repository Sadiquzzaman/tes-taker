import { configureStore } from "@reduxjs/toolkit";
import { classSlice } from "./features/classSlice";
import { subjectSlice } from "./features/subjectSlice";
import { testSlice } from "./features/testSlice";
import { gradingSlice } from "./features/gradingSlice";
import { createTestSlice } from "./features/createTestSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      class: classSlice.reducer,
      subject: subjectSlice.reducer,
      test: testSlice.reducer,
      grade: gradingSlice.reducer,
      createTest: createTestSlice.reducer,
    },
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
