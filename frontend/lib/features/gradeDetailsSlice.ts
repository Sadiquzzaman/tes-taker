import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type GradeDetailsDataPayload = {
  exam: GradingExamSummary;
  stats: GradingExamStats;
  submissions: GradingSubmissionListItem[];
  meta: GradingPaginationMeta;
};

const createInitialState = (): GradeDetailsSliceState => ({
  openModal: "",
  searchStudentInput: "",
  currentPage: 1,
  totalPages: 1,
  exam: null,
  stats: null,
  submissions: [],
  meta: null,
  selectedSubmission: null,
});

const initialState = createInitialState();

export const gradeDetailsSlice = createSlice({
  name: "gradeDetailsSlice",
  initialState,
  reducers: {
    setOpenModal: (state, action) => {
      state.openModal = action.payload;
    },
    setSearchStudentInput: (state, action) => {
      state.searchStudentInput = action.payload;
      state.currentPage = 1;
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    setSelectedSubmission: (state, action) => {
      state.selectedSubmission = action.payload;
    },
    setGradeDetailsData: (state, action: PayloadAction<GradeDetailsDataPayload>) => {
      state.exam = action.payload.exam;
      state.stats = action.payload.stats;
      state.submissions = action.payload.submissions;
      state.meta = action.payload.meta;
      state.currentPage = action.payload.meta.page;
      state.totalPages = Math.max(action.payload.meta.total_pages, 1);
    },
    resetGradeDetails: () => createInitialState(),
  },
});

export const {
  setOpenModal,
  setSearchStudentInput,
  setCurrentPage,
  setSelectedSubmission,
  setGradeDetailsData,
  resetGradeDetails,
} = gradeDetailsSlice.actions;

export default gradeDetailsSlice.reducer;
