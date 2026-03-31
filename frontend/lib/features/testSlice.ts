import { testsTabList } from "@/utils/testsTabList";
import { createSlice } from "@reduxjs/toolkit";

interface TestSliceState {
  activeTab: {
    name: string;
    value: string;
  };
  searchInput: string;
  newTestCreated: CreateClassResponse | null;
}

const initialState: TestSliceState = {
  activeTab: testsTabList[0],
  searchInput: "",
  newTestCreated: null,
};

export const testSlice = createSlice({
  name: "testSlice",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setSearchInput: (state, action) => {
      state.searchInput = action.payload;
    },
    setNewTestCreated: (state, action) => {
      state.newTestCreated = action.payload;
    },
  },
});

export const { setActiveTab, setSearchInput, setNewTestCreated } = testSlice.actions;

export default testSlice.reducer;
