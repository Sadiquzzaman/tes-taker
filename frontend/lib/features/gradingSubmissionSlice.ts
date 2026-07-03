import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";

const createEmptyEntry = (): GradingSubmissionCacheEntry => ({
  apiResponse: null,
  graded: [],
  saveResponse: null,
});

const initialState: GradingSubmissionSliceState = {
  values: {},
};

const getOrCreateEntry = (state: GradingSubmissionSliceState, examId: string, submissionId: string) => {
  if (!state.values[examId]) {
    state.values[examId] = {};
  }

  if (!state.values[examId][submissionId]) {
    state.values[examId][submissionId] = createEmptyEntry();
  }

  return state.values[examId][submissionId];
};

const mergeGrades = (
  incomingGrades: GradingSubmissionGrade[],
  existingGrades: GradingSubmissionGrade[],
): GradingSubmissionGrade[] => {
  return incomingGrades.map((incomingGrade) => {
    const cachedGrade = existingGrades.find((grade) => grade.question_id === incomingGrade.question_id);

    if (!cachedGrade) {
      return incomingGrade;
    }

    return {
      ...incomingGrade,
      explanation: cachedGrade.explanation,
      marks_obtained: cachedGrade.marks_obtained,
    };
  });
};

const updateCachedQuestionMarks = (data: GradingModalData, grades: GradingSubmissionGrade[]) => {
  const marksByQuestionId = new Map(grades.map((grade) => [grade.question_id, grade.marks_obtained]));

  data.items.forEach((item) => {
    if (item.kind !== "question") {
      return;
    }

    const marksObtained = marksByQuestionId.get(item.question.id);

    if (typeof marksObtained === "number") {
      item.question.marksObtained = marksObtained;
    }
  });
};

export const gradingSubmissionSlice = createSlice({
  name: "gradingSubmissionSlice",
  initialState,
  reducers: {
    cacheSubmissionGradingDetail: (state, action: PayloadAction<CacheSubmissionGradingDetailPayload>) => {
      const entry = getOrCreateEntry(state, action.payload.examId, action.payload.submissionId);

      entry.apiResponse = action.payload.apiResponse;
      entry.graded = mergeGrades(action.payload.graded, entry.graded);
      entry.fetchedAt = action.payload.fetchedAt ?? Date.now();
    },
    setSubmissionGrades: (state, action: PayloadAction<SetSubmissionGradesPayload>) => {
      const entry = getOrCreateEntry(state, action.payload.examId, action.payload.submissionId);
      entry.graded = action.payload.graded;
    },
    setSubmissionGradeScore: (state, action: PayloadAction<SetSubmissionGradeScorePayload>) => {
      const entry = getOrCreateEntry(state, action.payload.examId, action.payload.submissionId);
      const grade = entry.graded.find((item) => item.question_id === action.payload.questionId);

      if (!grade) {
        return;
      }

      grade.marks_obtained = action.payload.marksObtained;
    },
    setSubmissionGradeExplanation: (state, action: PayloadAction<SetSubmissionGradeExplanationPayload>) => {
      const entry = getOrCreateEntry(state, action.payload.examId, action.payload.submissionId);
      const grade = entry.graded.find((item) => item.question_id === action.payload.questionId);

      if (!grade) {
        return;
      }

      grade.explanation = action.payload.explanation;
    },
    cacheSubmissionSaveResponse: (state, action: PayloadAction<CacheSubmissionSaveResponsePayload>) => {
      const entry = getOrCreateEntry(state, action.payload.examId, action.payload.submissionId);

      entry.graded = action.payload.graded;
      entry.saveResponse = action.payload.saveResponse;

      if (!entry.apiResponse) {
        return;
      }

      updateCachedQuestionMarks(entry.apiResponse, action.payload.graded);
      entry.apiResponse.submission.totalScore = action.payload.saveResponse.total_score;
      entry.apiResponse.submission.maxScore = action.payload.saveResponse.max_score;
      entry.apiResponse.submission.percentage = action.payload.saveResponse.percentage;
      entry.apiResponse.submission.isGraded = action.payload.saveResponse.is_graded;
      entry.apiResponse.submission.gradingStatus = action.payload.saveResponse.grading_status;
      entry.apiResponse.totals.manualGradedCount = action.payload.saveResponse.manual_graded_count;
      entry.apiResponse.totals.manualTotalCount = action.payload.saveResponse.manual_total_count;
    },
  },
});

export const {
  cacheSubmissionGradingDetail,
  cacheSubmissionSaveResponse,
  setSubmissionGradeExplanation,
  setSubmissionGradeScore,
  setSubmissionGrades,
} = gradingSubmissionSlice.actions;

export const selectSubmissionGradingEntry = (
  state: RootState,
  examId?: string | null,
  submissionId?: string | null,
) => {
  if (!examId || !submissionId) {
    return null;
  }

  return state.gradingSubmission.values[examId]?.[submissionId] ?? null;
};

export default gradingSubmissionSlice.reducer;
