/** Values sent by the frontend for exam type */
export enum ExamKindEnum {
  MCQ = 'mcq',
  ESSAY = 'essay',
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
