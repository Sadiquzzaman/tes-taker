export enum ExamAccessReasonCodeEnum {
  OK = 'OK',
  NOT_STARTED = 'NOT_STARTED',
  ENDED = 'ENDED',
  ALREADY_SUBMITTED = 'ALREADY_SUBMITTED',
  DISQUALIFIED = 'DISQUALIFIED',
  NOT_ASSIGNED = 'NOT_ASSIGNED',
  /** The plan's max_students_per_exam is reached; only students who already started may continue. */
  EXAM_FULL = 'EXAM_FULL',
}

export enum ExamFinalizeReasonEnum {
  MANUAL = 'manual',
  TIMEOUT = 'timeout',
  DISQUALIFIED = 'disqualified',
}
