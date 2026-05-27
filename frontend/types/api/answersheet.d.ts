type AnswersheetMap = Record<string, string>;

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
