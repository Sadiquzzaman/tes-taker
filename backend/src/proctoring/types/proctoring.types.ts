export interface ProctoringFlagEntry {
  id: string;
  type: string;
  message: string;
  points: number;
  timestamp: string;
}

/** What the monitor shows for a student (PRO-03, PRO-07). */
export type ProctoringLiveStatus = 'WRITING' | 'SUBMITTED' | 'ENDED' | 'DISCONNECTED' | 'LOST';

export interface ProctoringStudentSession {
  socketId: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
  /** When the student's browser was last heard from (heartbeat or flag). */
  lastSeenAt: string;
  status: Exclude<ProctoringLiveStatus, 'LOST'>;
  /** Set once when monitoring was found lost; cleared when heard from again. */
  lostSince: string | null;
  totalFlagPoints: number;
  flagCount: number;
  latestFlag: ProctoringFlagEntry | null;
  /** The most recent flags, newest first. */
  flags: ProctoringFlagEntry[];
}

export interface ProctoringExamSubmitPayload {
  examId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>;
  totalFlagPoints: number;
}
