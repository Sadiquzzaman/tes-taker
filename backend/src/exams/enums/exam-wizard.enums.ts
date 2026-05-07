/** Values sent by the frontend for exam type (standalone mcq/essay removed; use hybrid or model). */
export enum ExamKindEnum {
  HYBRID = 'hybrid',
  MODEL = 'model',
}

export enum TestAudienceEnum {
  ANYONE = 'anyone',
  SELECTED_CLASS = 'selected_class',
  SPECIFIC_STUDENTS = 'specific_students',
}

export enum PublishTimingEnum {
  IMMEDIATELY = 'immediately',
  LATER = 'later',
}

/** Derived from exam_start_time / exam_end_time (not persisted) */
export enum ExamLifecycleStatusEnum {
  PENDING = 'pending',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
}
