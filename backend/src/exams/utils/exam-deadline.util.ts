import { ForbiddenException } from '@nestjs/common';
import { ExamEntity } from '../entities/exam.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamSubmissionEntity,
} from '../entities/student-exam-answer.entity';

export const computeEffectiveDeadline = (
  exam: Pick<ExamEntity, 'exam_end_time' | 'duration_minutes'>,
  submission: Pick<StudentExamSubmissionEntity, 'started_at'> | null,
): Date => {
  const examEnd = new Date(exam.exam_end_time);

  if (!submission?.started_at) {
    return examEnd;
  }

  const durationMinutes = exam.duration_minutes ?? 0;
  if (durationMinutes <= 0) {
    return examEnd;
  }

  const durationDeadline = new Date(submission.started_at.getTime() + durationMinutes * 60 * 1000);
  return new Date(Math.min(durationDeadline.getTime(), examEnd.getTime()));
};

export const computeRemainingTimeSeconds = (
  exam: Pick<ExamEntity, 'exam_end_time' | 'duration_minutes'>,
  submission: Pick<StudentExamSubmissionEntity, 'started_at'> | null,
  now: Date = new Date(),
): number => {
  const effectiveDeadline = computeEffectiveDeadline(exam, submission);
  return Math.max(0, Math.floor((effectiveDeadline.getTime() - now.getTime()) / 1000));
};

/** Late writes accepted after the deadline (network delay on the client's time-up submit). */
export const SUBMIT_GRACE_SECONDS = 60;

export const EXAM_TIME_EXPIRED_MESSAGE = 'Your exam time has expired';
export const ATTEMPT_NOT_ACTIVE_MESSAGE = 'This attempt is already submitted';

/**
 * Deadline for an attempt: the value stored at start, or computed for rows started
 * before `effective_deadline` existed.
 */
export const resolveSubmissionDeadline = (
  exam: Pick<ExamEntity, 'exam_end_time' | 'duration_minutes'>,
  submission: Pick<StudentExamSubmissionEntity, 'started_at' | 'effective_deadline'> | null,
): Date => {
  if (submission?.effective_deadline) {
    return new Date(submission.effective_deadline);
  }
  return computeEffectiveDeadline(exam, submission);
};

export const isPastDeadlineWithGrace = (
  exam: Pick<ExamEntity, 'exam_end_time' | 'duration_minutes'>,
  submission: Pick<StudentExamSubmissionEntity, 'started_at' | 'effective_deadline'> | null,
  now: Date = new Date(),
): boolean => {
  const deadline = resolveSubmissionDeadline(exam, submission);
  return now.getTime() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000;
};

/**
 * Every answer write and final submit must pass this: the attempt is IN_PROGRESS and
 * now <= effective deadline + grace.
 */
export const assertSubmissionWritable = (
  exam: Pick<ExamEntity, 'exam_end_time' | 'duration_minutes'>,
  submission: Pick<
    StudentExamSubmissionEntity,
    'status' | 'started_at' | 'effective_deadline'
  >,
  now: Date = new Date(),
): void => {
  if (submission.status !== ExamSubmissionStatusEnum.IN_PROGRESS) {
    throw new ForbiddenException(ATTEMPT_NOT_ACTIVE_MESSAGE);
  }
  if (isPastDeadlineWithGrace(exam, submission, now)) {
    throw new ForbiddenException(EXAM_TIME_EXPIRED_MESSAGE);
  }
};
