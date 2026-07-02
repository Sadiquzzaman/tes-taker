interface GradingSubmissionGrade {
  question_id: string;
  marks_obtained: number;
  explanation: string;
}

type GradingSubmissionGradeLookup = Record<string, GradingSubmissionGrade>;

type GradingSubmissionValidationErrorMap = Record<string, string>;

interface GradingSubmissionCacheEntry {
  apiResponse: GradingModalData | null;
  graded: GradingSubmissionGrade[];
  fetchedAt?: number;
  saveResponse?: SaveSubmissionGradesResponse | null;
}

interface GradingSubmissionCacheState {
  [examId: string]: {
    [submissionId: string]: GradingSubmissionCacheEntry;
  };
}

interface GradingSubmissionSliceState {
  values: GradingSubmissionCacheState;
}

interface CacheSubmissionGradingDetailPayload {
  examId: string;
  submissionId: string;
  apiResponse: GradingModalData;
  graded: GradingSubmissionGrade[];
  fetchedAt?: number;
}

interface SetSubmissionGradesPayload {
  examId: string;
  submissionId: string;
  graded: GradingSubmissionGrade[];
}

interface SetSubmissionGradeScorePayload {
  examId: string;
  submissionId: string;
  questionId: string;
  marksObtained: number;
}

interface SetSubmissionGradeExplanationPayload {
  examId: string;
  submissionId: string;
  questionId: string;
  explanation: string;
}

interface CacheSubmissionSaveResponsePayload {
  examId: string;
  submissionId: string;
  saveResponse: SaveSubmissionGradesResponse;
  graded: GradingSubmissionGrade[];
}
