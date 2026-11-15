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
  GROUP_NOT_FOUND: 'IELTS_GROUP_NOT_FOUND',
  /** The question group breaks a rule of the paper (type, list, answers, word limit, 40 numbers). */
  GROUP_INVALID: 'IELTS_GROUP_INVALID',
  /** Something is missing before a test can be published; `details.problems` lists it. */
  TEST_INCOMPLETE: 'IELTS_TEST_INCOMPLETE',
  ASSIGNMENT_NOT_FOUND: 'IELTS_ASSIGNMENT_NOT_FOUND',
  /** Only published tests are opened, for a batch of the centre, with the window's end after its start. */
  ASSIGNMENT_INVALID: 'IELTS_ASSIGNMENT_INVALID',
  /** The test is not open now (before or after its window). */
  NOT_OPEN: 'IELTS_NOT_OPEN',
  /** A mock runs Listening, Reading, Writing in that order. */
  MODULE_ORDER: 'IELTS_MODULE_ORDER',
  /** This module is not taken on screen yet. */
  MODULE_NOT_READY: 'IELTS_MODULE_NOT_READY',
  ATTEMPT_NOT_FOUND: 'IELTS_ATTEMPT_NOT_FOUND',
  /** The module was handed in (or its time ran out). */
  ATTEMPT_DONE: 'IELTS_ATTEMPT_DONE',
  /** An answer is for a question that is not in the attempt's module. */
  ANSWER_INVALID: 'IELTS_ANSWER_INVALID',
  /** Marks need every task, each criterion 0–9 in half bands. */
  MARKS_INVALID: 'IELTS_MARKS_INVALID',
  /** Only handed-in attempts are marked. */
  NOT_HANDED_IN: 'IELTS_NOT_HANDED_IN',
} as const;
