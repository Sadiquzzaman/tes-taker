import { classTabList } from "@/utils/classTabList";
import { createSlice } from "@reduxjs/toolkit";

export const classSlice = createSlice({
  name: "classSlice",
  initialState: {
    activeTab: classTabList[1],
    searchInput: "",
  },
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setSearchInput: (state, action) => {
      state.searchInput = action.payload;
    },
  },
});

export const { setActiveTab, setSearchInput } = classSlice.actions;

export default classSlice.reducer;
