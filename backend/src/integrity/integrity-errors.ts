/** Error codes of plagiarism checks (Epic 10), sent as `code` with the message. */
export const INTEGRITY_ERRORS = {
  STAFF_ONLY: 'INTEGRITY_STAFF_ONLY',
  MANAGERS_ONLY: 'INTEGRITY_MANAGERS_ONLY',
  SCOPE_NOT_FOUND: 'INTEGRITY_SCOPE_NOT_FOUND',
  MATCH_NOT_FOUND: 'INTEGRITY_MATCH_NOT_FOUND',
  /** High above Medium, both 1–100; fewest words 0–1000. */
  THRESHOLDS_INVALID: 'INTEGRITY_THRESHOLDS_INVALID',
} as const;
