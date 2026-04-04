import { gradingTabList } from "@/utils/gradingTabList";
import { createSlice } from "@reduxjs/toolkit";

interface GradingSliceState {
  activeTab: {
    name: string;
    value: string;
  };
  searchInput: string;
}

const initialState: GradingSliceState = {
  activeTab: gradingTabList[0],
  searchInput: "",
};

export const gradingSlice = createSlice({
  name: "gradingSlice",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setSearchInput: (state, action) => {
      state.searchInput = action.payload;
    },
  },
});

export const { setActiveTab, setSearchInput } = gradingSlice.actions;

export default gradingSlice.reducer;
