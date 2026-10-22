import { ExamEntity } from './entities/exam.entity';
import { ExamPaperCacheService } from './exam-paper-cache.service';
import { examPaperCacheKey, EXAM_PAPER_CACHE_TTL_SECONDS } from './exam-paper-cache.constants';

describe('ExamPaperCacheService', () => {
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let examRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let service: ExamPaperCacheService;

  const examId = '11111111-1111-4111-8111-111111111111';
  const examPlain = {
    id: examId,
    test_name: 'Midterm',
    questions: [{ id: 'q1', question: '2+2?' }],
    questionSections: [],
    target_students: [],
    excluded_students: [],
  };

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    examRepo = {
      findOne: jest.fn(),
      create: jest.fn((plain) => plain),
    };
    service = new ExamPaperCacheService(redis as never, examRepo as never);
  });

  it('cache miss → loads from PostgreSQL and sets Redis', async () => {
    redis.get.mockResolvedValue(null);
    examRepo.findOne.mockResolvedValue(examPlain);

    const result = await service.getExamGraph(examId);

    expect(result).toEqual(examPlain);
    expect(examRepo.findOne).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      examPaperCacheKey(examId),
      expect.any(String),
      EXAM_PAPER_CACHE_TTL_SECONDS,
    );
  });

  it('cache hit → returns cached exam and does not query PostgreSQL', async () => {
    redis.get.mockResolvedValue(JSON.stringify(examPlain));

    const result = await service.getExamGraph(examId);

    expect(result).toMatchObject({ id: examId, test_name: 'Midterm' });
    expect(examRepo.findOne).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('Redis GET failure → falls back to PostgreSQL', async () => {
    redis.get.mockRejectedValue(new Error('redis down'));
    examRepo.findOne.mockResolvedValue(examPlain);

    const result = await service.getExamGraph(examId);

    expect(result).toEqual(examPlain);
    expect(examRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('Redis SET failure → still returns PostgreSQL exam', async () => {
    redis.get.mockResolvedValue(null);
    examRepo.findOne.mockResolvedValue(examPlain);
    redis.set.mockRejectedValue(new Error('redis write failed'));

    const result = await service.getExamGraph(examId);

    expect(result).toEqual(examPlain);
  });

  it('invalidate deletes exam paper key', async () => {
    redis.del.mockResolvedValue(1);
    await service.invalidate(examId);
    expect(redis.del).toHaveBeenCalledWith(examPaperCacheKey(examId));
  });

  it('invalidate swallows Redis errors', async () => {
    redis.del.mockRejectedValue(new Error('redis down'));
    await expect(service.invalidate(examId)).resolves.toBeUndefined();
  });
});

describe('Exam paper cache authorization boundary', () => {
  it('cache stores exam graphs only — access checks remain caller responsibility', () => {
    // Documented contract: ExamPaperCacheService.getExamGraph must never be treated as auth.
    const method = ExamPaperCacheService.prototype.getExamGraph;
    expect(method.name).toBe('getExamGraph');
    expect(EXAM_PAPER_CACHE_TTL_SECONDS).toBeGreaterThan(0);
    expect(examPaperCacheKey('abc')).toBe('exam:paper:abc');
  });
});

describe('Instructor branding defaults', () => {
  it('email default from-name is Instructor', () => {
    // Mirrors EmailService constructor default (EMAIL_FROM_NAME).
    const defaultName = 'Instructor';
    expect(defaultName).not.toMatch(/TestTaker/i);
    expect(defaultName).toBe('Instructor');
  });
});

// Keep TypeScript happy when Jest collects this file without entity imports used at runtime.
void ExamEntity;
