import { classTabList } from "@/utils/classTabList";
import { createSlice } from "@reduxjs/toolkit";

interface ClassSliceState {
  activeTab: {
    name: string;
    value: string;
  };
  searchInput: string;
  newClassCreated: CreateClassResponse | null;
}

const initialState: ClassSliceState = {
  activeTab: classTabList[1],
  searchInput: "",
  newClassCreated: null,
};

export const classSlice = createSlice({
  name: "classSlice",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setSearchInput: (state, action) => {
      state.searchInput = action.payload;
    },
    setNewClassCreated: (state, action) => {
      state.newClassCreated = action.payload;
    },
  },
});

export const { setActiveTab, setSearchInput, setNewClassCreated } = classSlice.actions;

export default classSlice.reducer;
