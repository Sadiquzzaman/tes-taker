type AnswersheetMap = any;
type ExamAnswerValue = string | string[];
type ExamAnswerState = Record<string, ExamAnswerValue>;

interface ExamAnswerSliceState {
  examId: string | null;
  values: ExamAnswerState;
}

type SubmitAnswersheetResponsePayload = {
  submission_id: string;
  saved_count: number;
};

interface SubmitAnswersheetPayload {
  studentId: string;
  answersheet: AnswersheetMap;
}

interface SubmitAnswersheetRequest {
  examId: string;
  payload: SubmitAnswersheetPayload;
}
