/** Codes the homework API returns with its errors; the web app translates them (`homework.errors`). */
export const HOMEWORK_ERRORS = {
  /** Only staff of the workspace manage homework; a teacher only for subject classes they teach. */
  NOT_ALLOWED: 'HOMEWORK_NOT_ALLOWED',
  NOT_FOUND: 'HOMEWORK_NOT_FOUND',
  /** No subject class given, one not found or not taught by the teacher. */
  TARGETS_INVALID: 'HOMEWORK_TARGETS_INVALID',
  /** The subject classes are of different subjects or sessions. */
  TARGETS_MIXED: 'HOMEWORK_TARGETS_MIXED',
  /** A chosen student does not take the subject class. */
  STUDENT_NOT_IN_CLASS: 'HOMEWORK_STUDENT_NOT_IN_CLASS',
  /** The session is closed: its homework is read-only (FND-01). */
  SESSION_CLOSED: 'HOMEWORK_SESSION_CLOSED',
  /** An attachment is not one of the caller's uploads for homework. */
  FILE_INVALID: 'HOMEWORK_FILE_INVALID',
  /** The due date is in the past, or before the publish time. */
  DUE_INVALID: 'HOMEWORK_DUE_INVALID',
  /** A scheduled publish time is not in the future. */
  PUBLISH_AT_INVALID: 'HOMEWORK_PUBLISH_AT_INVALID',
  /** The change is not possible in this status (e.g. a withdrawn homework, or targets of a published one). */
  WRONG_STATUS: 'HOMEWORK_WRONG_STATUS',
  /** Homework done on paper is not handed in on the app (HW-05 scores it). */
  PAPER_NO_SUBMISSION: 'HOMEWORK_PAPER_NO_SUBMISSION',
  /** The due time has passed and the organisation does not accept late work. */
  LATE_NOT_ALLOWED: 'HOMEWORK_LATE_NOT_ALLOWED',
  /** The student has used every submission the organisation allows. */
  NO_MORE_SUBMISSIONS: 'HOMEWORK_NO_MORE_SUBMISSIONS',
  /** The teacher has scored it; no more hand-ins unless it is returned for redo. */
  ALREADY_SCORED: 'HOMEWORK_ALREADY_SCORED',
  /** Nothing to hand in: no files (photos or files homework) or no answer (typed answer homework). */
  SUBMISSION_EMPTY: 'HOMEWORK_SUBMISSION_EMPTY',
  /** More files than the organisation allows in one submission. */
  TOO_MANY_FILES: 'HOMEWORK_TOO_MANY_FILES',
  /** Homework settings out of range (penalty 0–100 %, resubmissions 0–3, files 1–10). */
  SETTINGS_INVALID: 'HOMEWORK_SETTINGS_INVALID',
} as const;
