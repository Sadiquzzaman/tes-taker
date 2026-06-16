export interface ProctoringFlagEntry {
  id: string;
  type: string;
  message: string;
  points: number;
  timestamp: string;
}

export interface ProctoringStudentSession {
  socketId: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
  totalFlagPoints: number;
  flags: ProctoringFlagEntry[];
}

export interface ProctoringExamSubmitPayload {
  examId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>;
  totalFlagPoints: number;
}
