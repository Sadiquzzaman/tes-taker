/** Error codes of the resource library (Epic 8), sent as `code` with the message. */
export const RESOURCE_ERRORS = {
  NOT_FOUND: 'RESOURCE_NOT_FOUND',
  FOLDER_NOT_FOUND: 'RESOURCE_FOLDER_NOT_FOUND',
  /** Only staff manage the library. */
  STAFF_ONLY: 'RESOURCE_STAFF_ONLY',
  /** Only the person who added it (or owners, admins and staff members) may change it. */
  NOT_YOURS: 'RESOURCE_NOT_YOURS',
  /** A file resource needs the caller's own upload for resources; a link needs a web address. */
  FILE_INVALID: 'RESOURCE_FILE_INVALID',
  URL_INVALID: 'RESOURCE_URL_INVALID',
  /** Shared only with subject classes the caller teaches (owners, admins and staff: any open one). */
  SHARE_NOT_ALLOWED: 'RESOURCE_SHARE_NOT_ALLOWED',
  SUBJECT_NOT_FOUND: 'RESOURCE_SUBJECT_NOT_FOUND',
} as const;
