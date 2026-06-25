import { ExamEntity } from '../entities/exam.entity';
import { StudentExamSubmissionEntity } from '../entities/student-exam-answer.entity';

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
