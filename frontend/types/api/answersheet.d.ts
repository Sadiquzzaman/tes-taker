type AnswersheetMap = Record<string, string>;

interface SubmitAnswersheetPayload {
  studentId: string;
  answersheet: AnswersheetMap;
}

interface SubmitAnswersheetRequest {
  examId: string;
  payload: SubmitAnswersheetPayload;
}
