type AnswersheetMap = any;
type ExamAnswerValue = string | string[];
type ExamAnswerState = Record<string, ExamAnswerValue>;

interface ExamAnswerSliceState {
  examId: string | null;
  values: ExamAnswerState;
}

type ExamSubmitReason = "manual" | "timeout" | "disqualified";

type SubmitAnswersheetResponsePayload = {
  submission_id: string;
  status?: string;
  saved_count: number;
  total_score?: number | null;
  max_score?: number | null;
  already_finalized?: boolean;
};

interface SubmitAnswersheetPayload {
  studentId: string;
  answersheet: AnswersheetMap;
  reason?: ExamSubmitReason;
  disqualification_reason?: string;
}

interface SubmitAnswersheetRequest {
  examId: string;
  payload: SubmitAnswersheetPayload;
  onSuccess?: (reason: ExamSubmitReason) => void;
}
