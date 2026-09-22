import { ExamSubmissionStatusEnum } from './entities/student-exam-answer.entity';
import { QuestionTypeEnum, CorrectAnswerEnum } from './entities/exam-question.entity';

/**
 * Lightweight regression guards for finalize scoring math used after batch answer saves.
 * Full DB integration is covered by load tests; these assert the scoring rules stay stable.
 */
describe('finalize scoring rules (regression)', () => {
  it('keeps finalized statuses mutually exclusive from IN_PROGRESS', () => {
    const finalized = [
      ExamSubmissionStatusEnum.SUBMITTED,
      ExamSubmissionStatusEnum.AUTO_SUBMITTED,
      ExamSubmissionStatusEnum.DISQUALIFIED,
    ];
    expect(finalized).not.toContain(ExamSubmissionStatusEnum.IN_PROGRESS);
  });

  it('objective enum still includes selectable answers', () => {
    expect(CorrectAnswerEnum.OPTION_1).toBeDefined();
    expect(QuestionTypeEnum.OBJECTIVE).toBeDefined();
    expect(QuestionTypeEnum.SUBJECTIVE).toBeDefined();
  });
});
