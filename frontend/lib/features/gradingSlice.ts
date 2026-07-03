import { gradingTabList } from "@/utils/gradingTabList";
import { createSlice } from "@reduxjs/toolkit";

const initialState: GradingSliceState = {
  activeTab: gradingTabList[0],
  page: 1,
  searchInput: "",
};

export const gradingSlice = createSlice({
  name: "gradingSlice",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
      state.page = 1;
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    setSearchInput: (state, action) => {
      state.searchInput = action.payload;
      state.page = 1;
    },
  },
});

export const { setActiveTab, setPage, setSearchInput } = gradingSlice.actions;

export default gradingSlice.reducer;
