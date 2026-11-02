/** Error codes of the holidays API; the web app translates them (messages `holidays.errors`). */
export const HOLIDAY_ERRORS = {
  INVALID_DATE: 'HOLIDAY_INVALID_DATE',
  RANGE_INVALID: 'HOLIDAY_RANGE_INVALID',
  RANGE_TOO_LONG: 'HOLIDAY_RANGE_TOO_LONG',
  PAST_LOCKED: 'HOLIDAY_PAST_LOCKED',
} as const;

/** Longest single holiday or closure, in days. */
export const MAX_HOLIDAY_DAYS = 120;
