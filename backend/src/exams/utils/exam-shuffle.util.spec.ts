import { randomUUID } from 'crypto';
import { QuestionCategoryEnum } from '../enums/question.enums';
import { ExamService } from '../exam.service';
import { scoreStudentAnswer } from './exam-question.util';
import { seededShuffle, shuffleMatchingRight, shuffleStudentPaper } from './exam-shuffle.util';

const opt = (id: string) => ({ id, text: `text ${id}`, image: null });

const LEFT = ['l1', 'l2', 'l3', 'l4'].map(opt);
const RIGHT = ['r1', 'r2', 'r3', 'r4'].map(opt);
const MATCHING_KEY = LEFT.map((l, i) => `${l.id}::${RIGHT[i].id}`);
const MCQ_OPTIONS = ['a', 'b', 'c', 'd', 'e'].map(opt);

const MATCHING_Q_ID = '11111111-1111-4111-8111-111111111111';
const MCQ_Q_ID = '22222222-2222-4222-8222-222222222222';
const TF_Q_ID = '33333333-3333-4333-8333-333333333333';
const PASSAGE_Q_ID = '44444444-4444-4444-8444-444444444444';
const CHILD_Q_ID = '55555555-5555-4555-8555-555555555555';

function questionEntity(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    category: QuestionCategoryEnum.GRADED,
    question_type: 'OBJECTIVE',
    question: 'Question text',
    points: 1,
    sort_order: 0,
    parent_id: null,
    options_json: null,
    matching_options_json: null,
    answer_json: null,
    ...overrides,
  };
}

function buildExam() {
  const questions = [
    questionEntity({
      id: MATCHING_Q_ID,
      sort_order: 1,
      sub_type: 'matching-ordering',
      matching_options_json: { left: LEFT, right: RIGHT },
      answer_json: { type: 'matchingOrdering', value: MATCHING_KEY },
    }),
    questionEntity({
      id: MCQ_Q_ID,
      sort_order: 2,
      sub_type: 'multiple-choice',
      options_json: MCQ_OPTIONS,
      answer_json: { type: 'optionId', value: ['c'] },
    }),
    questionEntity({
      id: TF_Q_ID,
      sort_order: 3,
      sub_type: 'true-false',
      options_json: ['t', 'f', 'ng'].map(opt),
      answer_json: { type: 'optionId', value: ['t'] },
    }),
    questionEntity({
      id: PASSAGE_Q_ID,
      sort_order: 4,
      category: QuestionCategoryEnum.PASSAGE,
      sub_type: null,
      passage_text: 'Passage',
    }),
    questionEntity({
      id: CHILD_Q_ID,
      sort_order: 0,
      category: QuestionCategoryEnum.PASSAGE,
      parent_id: PASSAGE_Q_ID,
      sub_type: 'matching-ordering',
      matching_options_json: { left: LEFT, right: RIGHT },
      answer_json: { type: 'matchingOrdering', value: MATCHING_KEY },
    }),
  ];

  return {
    id: 'exam-1',
    test_name: 'Test',
    exam_start_time: new Date(Date.now() - 60_000),
    exam_end_time: new Date(Date.now() + 3_600_000),
    duration_minutes: 60,
    questionSections: [{ id: 'section-1', sort_order: 0, questions }],
  };
}

/** Real ExamService formatters, with only the DB / access dependencies stubbed. */
function examServiceFor(submissionId: string | null) {
  const service = Object.create(ExamService.prototype) as ExamService;
  const exam = buildExam();
  Object.assign(service, {
    findOneEntity: jest.fn().mockResolvedValue(exam),
    assertStudentCanViewExam: jest.fn().mockResolvedValue(undefined),
    submissionRepo: {
      findOne: jest
        .fn()
        .mockResolvedValue(submissionId ? { id: submissionId, status: 'IN_PROGRESS', started_at: new Date() } : null),
    },
  });
  return service;
}

const STUDENT = { id: 'student-1', role: 'STUDENT' } as never;

/** The parts of a served question these tests read. */
type ServedOption = { id: string };
type ServedQuestion = {
  id: string;
  options: ServedOption[];
  matchingOptions: { left: ServedOption[]; right: ServedOption[] };
  childQuestions: ServedQuestion[];
  answer: { value: unknown };
};
type ServedPaper = { subjects: { questions: ServedQuestion[] }[] };

async function servedPaper(submissionId: string | null) {
  const payload = (await examServiceFor(submissionId).findOneForStudent('exam-1', STUDENT)) as unknown as ServedPaper;
  const questions = payload.subjects.flatMap((s) => s.questions);
  const byId = new Map<string, ServedQuestion>(questions.map((q) => [q.id, q]));
  return { payload, byId };
}

const ids = (options: { id: string }[]) => options.map((o) => o.id);

describe('seededShuffle', () => {
  it('gives the same order for the same seed', () => {
    const items = Array.from({ length: 8 }, (_, i) => i);
    expect(seededShuffle(items, 'sub-1', 'q')).toEqual(seededShuffle(items, 'sub-1', 'q'));
  });

  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 8 }, (_, i) => i);
    expect([...seededShuffle(items, 'sub-1', 'q')].sort((a, b) => a - b)).toEqual(items);
  });

  it('gives different submissions different orders (statistically)', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const counts = new Map<string, number>();
    const runs = 500;
    for (let i = 0; i < runs; i++) {
      const key = seededShuffle(items, randomUUID(), 'q').join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // 120 possible orders; a fair shuffle hits most of them and favours none.
    expect(counts.size).toBeGreaterThan(80);
    expect(Math.max(...counts.values())).toBeLessThan(runs * 0.05);

    // Every item lands in the first slot roughly 1/5 of the time.
    const firstSlot = new Map<string, number>();
    for (let i = 0; i < runs; i++) {
      const first = seededShuffle(items, randomUUID(), 'q')[0];
      firstSlot.set(first, (firstSlot.get(first) ?? 0) + 1);
    }
    for (const item of items) {
      expect(firstSlot.get(item) ?? 0).toBeGreaterThan(runs * 0.1);
      expect(firstSlot.get(item) ?? 0).toBeLessThan(runs * 0.3);
    }
  });
});

describe('shuffleMatchingRight', () => {
  it('never returns the key order for a multi-item column', () => {
    for (const size of [2, 3, 4, 5]) {
      const right = Array.from({ length: size }, (_, i) => opt(`r${i}`));
      for (let i = 0; i < 300; i++) {
        expect(ids(shuffleMatchingRight(right, randomUUID(), 'q'))).not.toEqual(ids(right));
      }
    }
  });

  it('leaves a single-item column alone', () => {
    expect(ids(shuffleMatchingRight([opt('r0')], 'seed', 'q'))).toEqual(['r0']);
  });
});

describe('shuffleStudentPaper', () => {
  it('removes answer-key fields, including on passage children', () => {
    const served = shuffleStudentPaper(
      [
        {
          questions: [
            { id: 'q1', options: MCQ_OPTIONS, answer: { type: 'optionId', value: ['a'] }, correctOptionId: 'a' },
            { id: 'p1', childQuestions: [{ id: 'c1', answer: { type: 'text', value: ['x'] } }] },
          ],
        },
      ],
      'seed',
    );
    expect(JSON.stringify(served)).not.toMatch(/"answer"|correctOptionId/);
  });
});

describe('ExamService.findOneForStudent (served paper)', () => {
  it('shows the same order on reload for the same submission', async () => {
    const first = await servedPaper('sub-a');
    const second = await servedPaper('sub-a');
    expect(first.payload.subjects).toEqual(second.payload.subjects);
  });

  it('never serves the matching right column in key order', async () => {
    for (let i = 0; i < 50; i++) {
      const { byId } = await servedPaper(randomUUID());
      expect(ids(byId.get(MATCHING_Q_ID)!.matchingOptions.right)).not.toEqual(ids(RIGHT));
      expect(ids(byId.get(MATCHING_Q_ID)!.matchingOptions.left)).toEqual(ids(LEFT));
      const child = byId.get(PASSAGE_Q_ID)!.childQuestions[0];
      expect(ids(child.matchingOptions.right)).not.toEqual(ids(RIGHT));
    }
  });

  it('shuffles MCQ options but keeps true/false order fixed', async () => {
    const mcqOrders = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { byId } = await servedPaper(randomUUID());
      mcqOrders.add(ids(byId.get(MCQ_Q_ID)!.options).join(''));
      expect(ids(byId.get(TF_Q_ID)!.options)).toEqual(['t', 'f', 'ng']);
    }
    expect(mcqOrders.size).toBeGreaterThan(1);
  });

  it('never serves the stored order even before a submission exists', async () => {
    const { byId } = await servedPaper(null);
    expect(ids(byId.get(MATCHING_Q_ID)!.matchingOptions.right)).not.toEqual(ids(RIGHT));
  });

  it('contains no answer key', async () => {
    const { payload } = await servedPaper('sub-a');
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/"answer"|correctOptionId|answer_json|matchingOrdering/);
    expect(json).not.toContain(MATCHING_KEY[0]);
  });

  it('scores a shuffled answer correctly (ids, not positions)', async () => {
    const { byId } = await servedPaper('sub-b');
    const exam = buildExam();
    const stored = exam.questionSections[0].questions;
    const matchingEntity = stored.find((q) => q.id === MATCHING_Q_ID) as never;
    const mcqEntity = stored.find((q) => q.id === MCQ_Q_ID) as never;

    // Student matches each left item to its correct right item, as shown in the shuffled column.
    const served = byId.get(MATCHING_Q_ID)!.matchingOptions;
    const correctPairs = served.left.map((l: { id: string }) => {
      const r = served.right.find((o: { id: string }) => o.id === `r${l.id.slice(1)}`)!;
      return `${l.id}::${r.id}`;
    });
    expect(scoreStudentAnswer(matchingEntity, correctPairs.join('|'))).toBe(true);

    // Leaving the shuffled column as served pairs left[i] with the wrong item.
    const asServed = served.left.map((l: { id: string }, i: number) => `${l.id}::${served.right[i].id}`);
    expect(scoreStudentAnswer(matchingEntity, asServed.join('|'))).toBe(false);

    // MCQ: the correct option is found by id wherever it was shuffled to.
    const mcqServed = byId.get(MCQ_Q_ID)!.options as { id: string }[];
    expect(scoreStudentAnswer(mcqEntity, mcqServed.find((o) => o.id === 'c')!.id)).toBe(true);
    expect(scoreStudentAnswer(mcqEntity, mcqServed[0].id === 'c' ? mcqServed[1].id : mcqServed[0].id)).toBe(false);
  });

  it('keeps the key order for the teacher view', async () => {
    const service = examServiceFor(null);
    Object.assign(service, {
      organizationAccessService: { assertCanMonitorExam: jest.fn().mockResolvedValue(undefined) },
    });
    const payload = (await service.findOne('exam-1', { id: 'teacher-1', role: 'TEACHER' } as never)) as unknown as ServedPaper;
    const matching = payload.subjects[0].questions.find((q) => q.id === MATCHING_Q_ID)!;
    expect(ids(matching.matchingOptions.right)).toEqual(ids(RIGHT));
    expect(matching.answer.value).toEqual(MATCHING_KEY);
  });
});
