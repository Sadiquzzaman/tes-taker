/** Error codes of the IELTS workspace (Epic 11), sent as `code` with the message. */
export const IELTS_ERRORS = {
  /** IELTS pages are for IELTS centres only. */
  ONLY_IELTS_CENTRES: 'IELTS_ONLY_CENTRES',
  STAFF_ONLY: 'IELTS_STAFF_ONLY',
  STUDENT_NOT_FOUND: 'IELTS_STUDENT_NOT_FOUND',
  /** A band is 0–9 in half bands. */
  BAND_INVALID: 'IELTS_BAND_INVALID',
} as const;
