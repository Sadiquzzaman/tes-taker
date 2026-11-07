/** Error codes of the holidays API; the web app translates them (messages `holidays.errors`). */
export const HOLIDAY_ERRORS = {
  INVALID_DATE: 'HOLIDAY_INVALID_DATE',
  RANGE_INVALID: 'HOLIDAY_RANGE_INVALID',
  RANGE_TOO_LONG: 'HOLIDAY_RANGE_TOO_LONG',
  PAST_LOCKED: 'HOLIDAY_PAST_LOCKED',
} as const;

/** Longest single holiday or closure, in days. */
export const MAX_HOLIDAY_DAYS = 120;

/** Error codes of section schedules (ATT-16); the web app translates them (messages `classSetup.errors`). */
export const SCHEDULE_ERRORS = {
  TIME_INVALID: 'SCHEDULE_TIME_INVALID',
  OVERLAP: 'SCHEDULE_OVERLAP',
  TEACHER_CLASH: 'SCHEDULE_TEACHER_CLASH',
  TOO_MANY: 'SCHEDULE_TOO_MANY',
} as const;

/** Error codes of the weekly routine (CAL-01, CAL-02); the web app translates them (messages `routine.errors`). */
export const ROUTINE_ERRORS = {
  NOT_FOUND: 'ROUTINE_NOT_FOUND',
  SUBJECT_INVALID: 'ROUTINE_SUBJECT_INVALID',
  TEACHER_INVALID: 'ROUTINE_TEACHER_INVALID',
  /** A teacher or room booked twice at overlapping times; `details.clashes` lists them. Send `confirm_clashes` to save anyway. */
  CLASH: 'ROUTINE_CLASH',
} as const;
