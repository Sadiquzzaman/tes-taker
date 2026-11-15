/** Error codes of the IELTS workspace (Epic 11), sent as `code` with the message. */
export const IELTS_ERRORS = {
  /** IELTS pages are for IELTS centres only. */
  ONLY_IELTS_CENTRES: 'IELTS_ONLY_CENTRES',
  STAFF_ONLY: 'IELTS_STAFF_ONLY',
  STUDENT_NOT_FOUND: 'IELTS_STUDENT_NOT_FOUND',
  /** A band is 0–9 in half bands. */
  BAND_INVALID: 'IELTS_BAND_INVALID',
  /** Only owners and admins change centre-wide IELTS settings (band tables). */
  MANAGERS_ONLY: 'IELTS_MANAGERS_ONLY',
  /** A band table runs from 40 down to 0, with bands 0–9 in half bands that never go up. */
  BAND_TABLE_INVALID: 'IELTS_BAND_TABLE_INVALID',
  TEST_NOT_FOUND: 'IELTS_TEST_NOT_FOUND',
  /** Only the teacher who made a test, an owner or an admin can change it. */
  TEST_NOT_YOURS: 'IELTS_TEST_NOT_YOURS',
  /** Only drafts can be built; unpublish first. */
  TEST_LOCKED: 'IELTS_TEST_LOCKED',
  /** The test does not fit the template (modules, parts, times). */
  TEST_INVALID: 'IELTS_TEST_INVALID',
  /** The file is not this centre's IELTS upload of the right kind. */
  FILE_INVALID: 'IELTS_FILE_INVALID',
} as const;
