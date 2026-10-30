import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { ExamEntity } from './entities/exam.entity';
import { TestAudienceEnum } from './enums/exam-wizard.enums';
import { QuestionTypeEnum } from './entities/exam-question.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamSubmissionEntity,
} from './entities/student-exam-answer.entity';
import { ExamFinalizeReasonEnum } from './enums/exam-access-reason.enum';
import { StudentExamService } from './student-exam.service';
import {
  ATTEMPT_NOT_ACTIVE_MESSAGE,
  assertSubmissionWritable,
  computeEffectiveDeadline,
  EXAM_TIME_EXPIRED_MESSAGE,
  resolveSubmissionDeadline,
  SUBMIT_GRACE_SECONDS,
} from './utils/exam-deadline.util';

/**
 * P0-06: every exam write (save-answer, answersheet autosave, final submit) requires
 * status IN_PROGRESS and now <= effective_deadline + 60 s (design §6.2).
 */
describe('exam deadline and attempt status on writes (P0-06)', () => {
  const examId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const submissionId = '33333333-3333-4333-8333-333333333333';
  const essayId = '44444444-4444-4444-8444-444444444444';

  // Exam window 10:00–12:00, 30-minute duration; student starts at 10:00 → deadline 10:30.
  const examStart = new Date('2026-10-23T10:00:00.000Z');
  const examEnd = new Date('2026-10-23T12:00:00.000Z');
  const startedAt = new Date('2026-10-23T10:00:00.000Z');
  const deadline = new Date('2026-10-23T10:30:00.000Z');
  const seconds = (n: number) => new Date(deadline.getTime() + n * 1000);

  let exam: ExamEntity;
  let submissionRow: Partial<StudentExamSubmissionEntity> | null;
  let submissionRepo: Record<string, jest.Mock>;
  let answerRepo: Record<string, jest.Mock>;
  let questionRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let examPaperCache: { getExamGraph: jest.Mock };
  let claimQuery: { execute: jest.Mock };
  let service: StudentExamService;

  const now = (date: Date) => jest.setSystemTime(date);

  beforeEach(() => {
    jest.useFakeTimers();
    now(new Date('2026-10-23T10:10:00.000Z'));

    exam = {
      id: examId,
      is_active: ActiveStatusEnum.ACTIVE,
      test_audience: TestAudienceEnum.ANYONE,
      exam_start_time: examStart,
      exam_end_time: examEnd,
      duration_minutes: 30,
      organization_id: null,
      questionSections: [],
      questions: [
        {
          id: essayId,
          question_type: QuestionTypeEnum.SUBJECTIVE,
          question: 'Explain photosynthesis.',
          sort_order: 1,
        },
      ],
    } as unknown as ExamEntity;

    submissionRow = {
      id: submissionId,
      exam_id: examId,
      student_id: studentId,
      status: ExamSubmissionStatusEnum.IN_PROGRESS,
      started_at: startedAt,
      effective_deadline: deadline,
    };

    claimQuery = { execute: jest.fn().mockResolvedValue({ affected: 1 }) };
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: claimQuery.execute,
    };

    submissionRepo = {
      findOne: jest.fn(async () => (submissionRow ? { ...submissionRow } : null)),
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    answerRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
    };
    questionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: essayId }),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === StudentExamSubmissionEntity ? submissionRepo : answerRepo,
      ),
    };
    dataSource = { transaction: jest.fn((work) => work(manager)) };
    examPaperCache = { getExamGraph: jest.fn(async () => exam) };

    service = new StudentExamService(
      {} as never, // examRepo
      questionRepo as never,
      submissionRepo as never,
      answerRepo as never,
      {} as never, // classRepo
      {} as never, // enrolmentRepo
      {} as never, // userRepo
      {} as never, // smsService
      dataSource as never,
      {} as never, // classService (ANYONE audience skips class lookup)
      examPaperCache as never,
      // No student cap (0 = unlimited); the cap has its own spec.
      { getEntitlements: jest.fn(async () => ({ limits: {} })) } as never, // entitlementsService
      {} as never, // soloOrganizations
      {} as never, // sessionRepo
    );

    // Scoring is covered elsewhere; these tests only care about who may write when.
    const internals = service as unknown as Record<string, () => Promise<void>>;
    jest.spyOn(internals, 'calculateObjectiveScore').mockResolvedValue(undefined);
    jest.spyOn(internals, 'calculateSubjectiveMaxScore').mockResolvedValue(undefined);
    jest.spyOn(internals, 'syncSubmissionScoresFromExam').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const finalize = (reason: ExamFinalizeReasonEnum) =>
    service.finalizeAnswerSheet(examId, studentId, undefined, {
      answersheet: { [essayId]: 'Plants turn light into sugar.' },
      reason,
    });
  const autosave = () =>
    service.saveAnswerSheet(examId, studentId, undefined, {
      answersheet: { [essayId]: 'Plants turn light into sugar.' },
    });
  const saveOne = () =>
    service.saveAnswer(examId, studentId, undefined, {
      question_id: essayId,
      text_answer: 'Plants turn light into sugar.',
    });

  describe('deadline helpers', () => {
    it('effective deadline is the earlier of start + duration and exam end', () => {
      expect(computeEffectiveDeadline(exam, { started_at: startedAt })).toEqual(deadline);
      const lateStart = new Date('2026-10-23T11:45:00.000Z');
      expect(computeEffectiveDeadline(exam, { started_at: lateStart })).toEqual(examEnd);
    });

    it('falls back to computing the deadline for attempts started before the column existed', () => {
      expect(
        resolveSubmissionDeadline(exam, { started_at: startedAt, effective_deadline: null }),
      ).toEqual(deadline);
    });

    it('allows a write exactly at deadline + grace and refuses one a second later', () => {
      const row = submissionRow as StudentExamSubmissionEntity;
      expect(() => assertSubmissionWritable(exam, row, seconds(SUBMIT_GRACE_SECONDS))).not.toThrow();
      expect(() => assertSubmissionWritable(exam, row, seconds(SUBMIT_GRACE_SECONDS + 1))).toThrow(
        EXAM_TIME_EXPIRED_MESSAGE,
      );
    });
  });

  describe('normal in-time flow', () => {
    it('startExam stores effective_deadline on the new submission', async () => {
      submissionRow = null;
      now(startedAt);

      const created = await service.startExam(examId, studentId, undefined, {} as never);

      expect(created.status).toBe(ExamSubmissionStatusEnum.IN_PROGRESS);
      expect(created.effective_deadline).toEqual(deadline);
    });

    it('save-answer, autosave and manual final submit succeed before the deadline', async () => {
      await expect(saveOne()).resolves.toMatchObject({ question_id: essayId });
      await expect(autosave()).resolves.toEqual({ submission_id: submissionId, saved_count: 1 });

      const result = await finalize(ExamFinalizeReasonEnum.MANUAL);

      expect(result.status).toBe(ExamSubmissionStatusEnum.SUBMITTED);
      expect(result.already_finalized).toBeUndefined();
      expect(claimQuery.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('final submit (POST /:examId/answersheet)', () => {
    it('accepts a time-up submit arriving within the grace window', async () => {
      now(seconds(30));

      const result = await finalize(ExamFinalizeReasonEnum.TIMEOUT);

      expect(result.status).toBe(ExamSubmissionStatusEnum.AUTO_SUBMITTED);
      expect(answerRepo.save).toHaveBeenCalled();
    });

    it('refuses a submit after deadline + grace and saves nothing', async () => {
      now(seconds(SUBMIT_GRACE_SECONDS + 1));

      await expect(finalize(ExamFinalizeReasonEnum.MANUAL)).rejects.toThrow(
        new ForbiddenException(EXAM_TIME_EXPIRED_MESSAGE),
      );
      await expect(finalize(ExamFinalizeReasonEnum.TIMEOUT)).rejects.toThrow(ForbiddenException);
      expect(answerRepo.save).not.toHaveBeenCalled();
      expect(claimQuery.execute).not.toHaveBeenCalled();
    });

    it('refuses a late submit for an old attempt with no stored deadline', async () => {
      submissionRow = { ...submissionRow, effective_deadline: null };
      now(seconds(SUBMIT_GRACE_SECONDS + 1));

      await expect(finalize(ExamFinalizeReasonEnum.MANUAL)).rejects.toThrow(
        EXAM_TIME_EXPIRED_MESSAGE,
      );
    });

    it('re-sending after submit returns the finished attempt without changing it', async () => {
      submissionRow = { ...submissionRow, status: ExamSubmissionStatusEnum.SUBMITTED };

      const result = await finalize(ExamFinalizeReasonEnum.MANUAL);

      expect(result).toMatchObject({
        status: ExamSubmissionStatusEnum.SUBMITTED,
        already_finalized: true,
        saved_count: 0,
      });
      expect(answerRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('autosave after the deadline', () => {
    it('refuses answersheet autosave after deadline + grace', async () => {
      now(seconds(SUBMIT_GRACE_SECONDS + 1));

      await expect(autosave()).rejects.toThrow(EXAM_TIME_EXPIRED_MESSAGE);
      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    it('refuses save-answer after deadline + grace', async () => {
      now(seconds(SUBMIT_GRACE_SECONDS + 1));

      await expect(saveOne()).rejects.toThrow(EXAM_TIME_EXPIRED_MESSAGE);
      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    it('accepts autosave within the grace window', async () => {
      now(seconds(SUBMIT_GRACE_SECONDS));

      await expect(autosave()).resolves.toMatchObject({ saved_count: 1 });
    });

    it('refuses autosave after the exam end even when the duration is longer', async () => {
      exam.duration_minutes = 240;
      submissionRow = { ...submissionRow, effective_deadline: examEnd };
      now(new Date(examEnd.getTime() + (SUBMIT_GRACE_SECONDS + 1) * 1000));

      await expect(autosave()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('writes after the attempt is finished', () => {
    it.each([
      ExamSubmissionStatusEnum.SUBMITTED,
      ExamSubmissionStatusEnum.AUTO_SUBMITTED,
      ExamSubmissionStatusEnum.DISQUALIFIED,
    ])('refuses save-answer and autosave when status is %s', async (status) => {
      submissionRow = { ...submissionRow, status };

      await expect(saveOne()).rejects.toThrow(ForbiddenException);
      await expect(autosave()).rejects.toThrow(ForbiddenException);
      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a save that loses the race with a final submit (re-checked under row lock)', async () => {
      // First read (before the write) sees IN_PROGRESS; the locked read sees SUBMITTED.
      submissionRepo.findOne
        .mockResolvedValueOnce({ ...submissionRow }) // validateExamAccess
        .mockResolvedValueOnce({ ...submissionRow }) // saveAnswer lookup
        .mockResolvedValueOnce({ ...submissionRow, status: ExamSubmissionStatusEnum.SUBMITTED });

      await expect(saveOne()).rejects.toThrow(ATTEMPT_NOT_ACTIVE_MESSAGE);
      expect(submissionRepo.findOne).toHaveBeenLastCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    it('still asks the student to start first when there is no attempt', async () => {
      submissionRow = null;

      await expect(saveOne()).rejects.toThrow(BadRequestException);
    });
  });
});
