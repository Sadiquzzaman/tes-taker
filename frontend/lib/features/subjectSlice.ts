import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const initialState: SubjectCatalogState = {
  subjects: [],
};

export const subjectSlice = createSlice({
  name: "subjectSlice",
  initialState,
  reducers: {
    setSubjects: (state, action: PayloadAction<SubjectCatalogState["subjects"]>) => {
      state.subjects = action.payload;
    },
    addSubject: (state, action: PayloadAction<SubjectCatalogState["subjects"][number]>) => {
      const existingSubjectIndex = state.subjects.findIndex((subject) => subject.id === action.payload.id);

      if (existingSubjectIndex !== -1) {
        state.subjects[existingSubjectIndex] = action.payload;
        return;
      }

      state.subjects.push(action.payload);
    },
  },
});

export const { setSubjects, addSubject } = subjectSlice.actions;

export default subjectSlice.reducer;
