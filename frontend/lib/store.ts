import { configureStore } from "@reduxjs/toolkit";
import { classSlice } from "./features/classSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      class: classSlice.reducer,
    },
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
