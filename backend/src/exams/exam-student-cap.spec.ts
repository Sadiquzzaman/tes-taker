import { ForbiddenException } from '@nestjs/common';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { LimitKey } from 'src/subscriptions/constants/feature-catalog';
import { ExamEntity } from './entities/exam.entity';
import { ExamSubmissionStatusEnum, StudentExamSubmissionEntity } from './entities/student-exam-answer.entity';
import { ExamAccessReasonCodeEnum } from './enums/exam-access-reason.enum';
import { TestAudienceEnum } from './enums/exam-wizard.enums';
import { EXAM_FULL_MESSAGE, StudentExamService } from './student-exam.service';

/**
 * Review loophole #8: max_students_per_exam (exam creator's plan) is enforced when a
 * student starts, not only when the exam is created. Students who already started can
 * always continue; a cap of 0 means no limit.
 */
describe('student cap at exam start', () => {
  const examId = '11111111-1111-4111-8111-111111111111';
  const teacherId = '55555555-5555-4555-8555-555555555555';
  const newStudent = '22222222-2222-4222-8222-222222222222';

  let exam: ExamEntity;
  let existingSubmission: Partial<StudentExamSubmissionEntity> | null;
  let startedCount: number;
  let cap: number | undefined;
  let submissionRepo: Record<string, jest.Mock>;
  let txSubmissions: Record<string, jest.Mock>;
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  const organizationId = '77777777-7777-4777-8777-777777777777';
  let entitlementsService: { getEntitlements: jest.Mock };
  let service: StudentExamService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T10:10:00.000Z'));

    exam = {
      id: examId,
      created_by: teacherId,
      is_active: ActiveStatusEnum.ACTIVE,
      test_audience: TestAudienceEnum.ANYONE,
      exam_start_time: new Date('2026-10-23T10:00:00.000Z'),
      exam_end_time: new Date('2026-10-23T12:00:00.000Z'),
      duration_minutes: 30,
      // Every exam belongs to an organisation (P2-01); the cap comes from its plan (P2-02).
      organization_id: organizationId,
      questionSections: [],
      questions: [],
    } as unknown as ExamEntity;

    existingSubmission = null;
    startedCount = 0;
    cap = 2;

    submissionRepo = {
      findOne: jest.fn(async () => (existingSubmission ? { ...existingSubmission } : null)),
      count: jest.fn(async () => startedCount),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    // Inside the transaction the count is read again after locking the exam row.
    txSubmissions = {
      count: jest.fn(async () => startedCount),
      save: jest.fn(async (row) => ({ ...row, id: 'new-submission' })),
    };
    manager = { query: jest.fn(), getRepository: jest.fn(() => txSubmissions) };
    dataSource = { transaction: jest.fn((work) => work(manager)) };
    entitlementsService = {
      getEntitlements: jest.fn(async () => ({
        limits: cap === undefined ? {} : { [LimitKey.MAX_STUDENTS_PER_EXAM]: cap },
      })),
    };

    service = new StudentExamService(
      {} as never, // examRepo
      {} as never, // questionRepo
      submissionRepo as never,
      {} as never, // answerRepo
      {} as never, // classRepo
      {} as never, // enrolmentRepo
      {} as never, // userRepo
      {} as never, // smsService
      dataSource as never,
      {} as never, // classService (ANYONE audience skips class lookup)
      { getExamGraph: jest.fn(async () => exam) } as never, // examPaperCache
      entitlementsService as never,
      {} as never, // soloOrganizations
      {} as never, // sessionRepo
      { record: jest.fn() } as never, // audit
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('eligibility (validateExamAccess)', () => {
    it('refuses a new student once the cap is reached', async () => {
      startedCount = 2;

      const result = await service.validateExamAccess(examId, newStudent);

      expect(result).toMatchObject({
        canAccess: false,
        reason: EXAM_FULL_MESSAGE,
        reason_code: ExamAccessReasonCodeEnum.EXAM_FULL,
      });
      expect(entitlementsService.getEntitlements).toHaveBeenCalledWith(organizationId);
    });

    it('lets a new student in while places are left', async () => {
      startedCount = 1;

      await expect(service.validateExamAccess(examId, newStudent)).resolves.toMatchObject({
        canAccess: true,
        reason_code: ExamAccessReasonCodeEnum.OK,
      });
    });

    it('lets a student who already started continue even when the exam is full', async () => {
      startedCount = 2;
      existingSubmission = {
        id: 'sub-1',
        exam_id: examId,
        student_id: newStudent,
        status: ExamSubmissionStatusEnum.IN_PROGRESS,
        started_at: new Date('2026-10-23T10:05:00.000Z'),
      };

      await expect(service.validateExamAccess(examId, newStudent)).resolves.toMatchObject({ canAccess: true });
      expect(entitlementsService.getEntitlements).not.toHaveBeenCalled();
    });

    it('treats a cap of 0 or no cap as unlimited', async () => {
      startedCount = 1000;
      cap = 0;
      await expect(service.validateExamAccess(examId, newStudent)).resolves.toMatchObject({ canAccess: true });

      cap = undefined;
      await expect(service.validateExamAccess(examId, newStudent)).resolves.toMatchObject({ canAccess: true });
      expect(submissionRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('startExam', () => {
    it('creates the submission inside a transaction that locks the exam row', async () => {
      startedCount = 1;

      const created = await service.startExam(examId, newStudent, undefined, {} as never);

      expect(created.id).toBe('new-submission');
      expect(manager.query).toHaveBeenCalledWith('SELECT id FROM exams WHERE id = $1 FOR UPDATE', [examId]);
      expect(txSubmissions.count).toHaveBeenCalledWith({ where: { exam_id: examId } });
      expect(txSubmissions.save).toHaveBeenCalledTimes(1);
    });

    it('refuses the start when the last place was taken after the eligibility check', async () => {
      // Eligibility saw a free place, but another student started before the lock was taken.
      submissionRepo.count.mockResolvedValue(1);
      txSubmissions.count.mockResolvedValue(2);

      await expect(service.startExam(examId, newStudent, undefined, {} as never)).rejects.toEqual(
        new ForbiddenException(EXAM_FULL_MESSAGE),
      );
      expect(txSubmissions.save).not.toHaveBeenCalled();
    });

    it('refuses a new student when the exam is already full', async () => {
      startedCount = 2;

      await expect(service.startExam(examId, newStudent, undefined, {} as never)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('saves directly, without a transaction, when the plan has no cap', async () => {
      cap = 0;

      await service.startExam(examId, newStudent, undefined, {} as never);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(submissionRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
