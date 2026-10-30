import { ExamEntity } from './entities/exam.entity';
import { ExamSubmissionStatusEnum, StudentExamSubmissionEntity } from './entities/student-exam-answer.entity';
import { StudentExamService } from './student-exam.service';

/**
 * exams.auto-submit (design §7, P0-06 follow-up): abandoned attempts past
 * effective_deadline + 60 s are finalised as AUTO_SUBMITTED with their saved answers.
 */
describe('StudentExamService.autoSubmitExpired', () => {
  const now = new Date('2026-10-23T11:00:00.000Z');
  const exam = {
    id: 'exam-1',
    exam_start_time: new Date('2026-10-23T10:00:00.000Z'),
    exam_end_time: new Date('2026-10-23T12:00:00.000Z'),
    duration_minutes: 30,
    questions: [],
    questionSections: [],
  } as unknown as ExamEntity;

  const attempt = (overrides: Partial<StudentExamSubmissionEntity>) =>
    ({
      id: 'sub-1',
      exam_id: exam.id,
      status: ExamSubmissionStatusEnum.IN_PROGRESS,
      started_at: new Date('2026-10-23T10:00:00.000Z'),
      effective_deadline: new Date('2026-10-23T10:30:00.000Z'),
      ...overrides,
    }) as StudentExamSubmissionEntity;

  let candidates: StudentExamSubmissionEntity[];
  let queryBuilder: Record<string, jest.Mock>;
  let service: StudentExamService;
  let completeSubmission: jest.SpyInstance;
  let getExamGraph: jest.Mock;

  beforeEach(() => {
    candidates = [];
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => candidates),
    };
    getExamGraph = jest.fn(async () => exam);
    service = new StudentExamService(
      {} as never, // examRepo
      {} as never, // questionRepo
      { createQueryBuilder: jest.fn(() => queryBuilder) } as never, // submissionRepo
      {} as never, // answerRepo
      {} as never, // classRepo
      {} as never, // enrolmentRepo
      {} as never, // userRepo
      {} as never, // dataSource
      {} as never, // classService
      { getExamGraph } as never, // examPaperCache
      {} as never, // entitlementsService
      {} as never, // soloOrganizations
      {} as never, // sessionRepo
      { record: jest.fn() } as never, // audit
      {} as never, // gradingScales
    );
    completeSubmission = jest
      .spyOn(service as unknown as Record<string, () => Promise<unknown>>, 'completeSubmission')
      .mockResolvedValue({ already_finalized: false });
    jest.spyOn((service as unknown as { logger: { log: () => void } }).logger, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('only queries IN_PROGRESS attempts whose stored deadline + 60 s has passed, or have none stored', async () => {
    await service.autoSubmitExpired(now);

    expect(queryBuilder.where).toHaveBeenCalledWith('submission.status = :inProgress', {
      inProgress: ExamSubmissionStatusEnum.IN_PROGRESS,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(submission.effective_deadline < :cutoff OR submission.effective_deadline IS NULL)',
      { cutoff: new Date('2026-10-23T10:59:00.000Z') },
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(200);
  });

  it('finalises an expired attempt as AUTO_SUBMITTED with its saved answers', async () => {
    candidates = [attempt({})];

    await expect(service.autoSubmitExpired(now)).resolves.toEqual({ checked: 1, submitted: 1 });

    expect(completeSubmission).toHaveBeenCalledWith(exam, candidates[0], {
      status: ExamSubmissionStatusEnum.AUTO_SUBMITTED,
      savedCount: 0,
    });
  });

  it('computes the deadline for attempts started before effective_deadline existed', async () => {
    // Started 10:00 with a 30-minute duration: deadline 10:30, expired at 11:00.
    const legacyExpired = attempt({ id: 'legacy-old', effective_deadline: null });
    // Started 10:45: deadline 11:15, still running at 11:00.
    const legacyRunning = attempt({
      id: 'legacy-new',
      effective_deadline: null,
      started_at: new Date('2026-10-23T10:45:00.000Z'),
    });
    candidates = [legacyExpired, legacyRunning];

    await expect(service.autoSubmitExpired(now)).resolves.toEqual({ checked: 2, submitted: 1 });

    expect(completeSubmission).toHaveBeenCalledTimes(1);
    expect(completeSubmission.mock.calls[0][1]).toBe(legacyExpired);
  });

  it('does not count attempts another finaliser got to first', async () => {
    candidates = [attempt({})];
    completeSubmission.mockResolvedValue({ already_finalized: true });

    await expect(service.autoSubmitExpired(now)).resolves.toEqual({ checked: 1, submitted: 0 });
  });

  it('skips attempts whose exam no longer exists', async () => {
    candidates = [attempt({})];
    getExamGraph.mockResolvedValue(null);

    await expect(service.autoSubmitExpired(now)).resolves.toEqual({ checked: 1, submitted: 0 });
    expect(completeSubmission).not.toHaveBeenCalled();
  });

  it('finishes the batch, then fails the job if any attempt failed (so it is retried)', async () => {
    jest.spyOn((service as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => undefined);
    candidates = [attempt({ id: 'broken' }), attempt({ id: 'fine' })];
    completeSubmission.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ already_finalized: false });

    await expect(service.autoSubmitExpired(now)).rejects.toThrow('Auto-submit failed for 1 attempt(s): broken');
    expect(completeSubmission).toHaveBeenCalledTimes(2);
  });
});
