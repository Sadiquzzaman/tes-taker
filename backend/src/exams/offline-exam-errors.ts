/** Codes the paper-exam API returns with its errors; the web app translates them (`marks.errors`). */
export const OFFLINE_EXAM_ERRORS = {
  /** Only staff of the workspace manage paper exams; a teacher only for subject classes they teach. */
  NOT_ALLOWED: 'OFFLINE_EXAM_NOT_ALLOWED',
  NOT_FOUND: 'OFFLINE_EXAM_NOT_FOUND',
  /** The session is closed: its exams and marks are read-only (FND-01). */
  SESSION_CLOSED: 'OFFLINE_EXAM_SESSION_CLOSED',
  /** Parts need distinct names and must add up to the total marks. */
  PARTS_INVALID: 'OFFLINE_EXAM_PARTS_INVALID',
  /** The term is not one of the subject class's session. */
  TERM_INVALID: 'OFFLINE_EXAM_TERM_INVALID',
  /** Marks are negative, above the total (or a part's marks), or parts are missing. */
  MARKS_INVALID: 'OFFLINE_EXAM_MARKS_INVALID',
  /** The student does not take the subject class. */
  STUDENT_NOT_IN_CLASS: 'OFFLINE_EXAM_STUDENT_NOT_IN_CLASS',
  /** The new total (or parts) is below marks already entered. */
  TOTAL_BELOW_MARKS: 'OFFLINE_EXAM_TOTAL_BELOW_MARKS',
} as const;
