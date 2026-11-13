/** Error codes of the chat API (Epic 7), sent as `code` with the message. */
export const CHAT_ERRORS = {
  NOT_FOUND: 'CHAT_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'CHAT_MESSAGE_NOT_FOUND',
  /** Text or at least one file is needed. */
  EMPTY: 'CHAT_EMPTY',
  /** Announcement mode: only teachers start posts; everyone may comment. */
  TEACHERS_ONLY: 'CHAT_TEACHERS_ONLY',
  /** Teachers of the group only (pin, settings, deleting others' messages). */
  NOT_TEACHER: 'CHAT_NOT_TEACHER',
  /** The subject class's session is closed: its chat is read-only (COM-06). */
  READ_ONLY: 'CHAT_READ_ONLY',
  /** Attachments must be the sender's own uploads for chat. */
  FILE_INVALID: 'CHAT_FILE_INVALID',
  /** Only posts can be pinned or commented on. */
  NOT_A_POST: 'CHAT_NOT_A_POST',
} as const;
