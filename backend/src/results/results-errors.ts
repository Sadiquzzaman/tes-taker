/** Codes the results API returns with its errors; the web app translates them (`behaviour.errors`, `results.errors`). */
export const RESULTS_ERRORS = {
  /** Only staff of the workspace rate behaviour; a teacher only in subject classes they teach. */
  NOT_ALLOWED: 'RESULTS_NOT_ALLOWED',
  NOT_FOUND: 'RESULTS_NOT_FOUND',
  /** The session is closed: its ratings are read-only (FND-01). */
  SESSION_CLOSED: 'RESULTS_SESSION_CLOSED',
  /** Criteria need distinct names in both languages; at most 10. */
  CRITERIA_INVALID: 'RESULTS_CRITERIA_INVALID',
  /** A rating is not 1–5, a criterion is not one of the organisation's, or the date is in the future. */
  RATING_INVALID: 'RESULTS_RATING_INVALID',
  /** A remark is kept with that day's ratings, so it needs at least one. */
  REMARK_NEEDS_RATING: 'RESULTS_REMARK_NEEDS_RATING',
  /** The student does not take the subject class. */
  STUDENT_NOT_IN_CLASS: 'RESULTS_STUDENT_NOT_IN_CLASS',
} as const;
