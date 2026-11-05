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
