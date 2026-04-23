import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SubjectCatalogState = {
  subjects: Array<{
    id: string;
    name: string;
    value: string;
  }>;
};

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
