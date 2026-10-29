import { randomUUID } from 'crypto';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };

/**
 * A solo teacher's exams live in their SOLO organisation (P2-01), and they must still be able to
 * edit them in their personal workspace (regression: the edit refused any exam with an organisation).
 */
describe('editing a solo teacher exam', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let teacher: UserEntity;
  let subjectId: string;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    teacher = await make.teacher();
    const subject = await t.dataSource.getRepository(SubjectEntity).save({ name: `Physics ${randomUUID().slice(0, 6)}` });
    subjectId = subject.id;
  });

  afterAll(async () => {
    await t.close();
  });

  const wizard = (testName: string) => {
    const correct = randomUUID();
    return {
      formState: { testName, duration: '30', passingScore: '', allowNegativeMarking: false, negativeMarking: '', isModelTest: false },
      subjects: [
        {
          id: subjectId,
          questions: [
            {
              id: randomUUID(),
              type: 'graded',
              subType: 'multiple-choice',
              text: 'Which force keeps the Moon in orbit?',
              instruction: '',
              image: null,
              answer: { type: 'optionId', value: [correct] },
              options: [
                { id: correct, text: 'Gravity', image: null },
                { id: randomUUID(), text: 'Friction', image: null },
                { id: randomUUID(), text: 'Magnetism', image: null },
              ],
              points: 2,
              showValidation: false,
            },
          ],
        },
      ],
      publishState: {
        publishTiming: 'later',
        scheduleAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        endingAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        testAudience: 'anyone',
        excluded_students: [],
      },
    };
  };

  it('creates the exam in the SOLO organisation and edits it', async () => {
    const created = await t.api.post<Payload<{ id: string }>>('/exams', wizard('Quiz 1'), t.tokenFor(teacher));
    expect(created.status).toBe(201);
    const saved = await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: created.body.payload.id });
    expect(saved.organization_id).toBeTruthy();

    const updated = await t.api.request<Payload<{ test_name: string }>>('PUT', `/exams/${created.body.payload.id}`, {
      body: wizard('Quiz 1 (edited)'),
      token: t.tokenFor(teacher),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.payload.test_name).toBe('Quiz 1 (edited)');
  });

  it("does not let another solo teacher edit it", async () => {
    const created = await t.api.post<Payload<{ id: string }>>('/exams', wizard('Quiz 2'), t.tokenFor(teacher));
    const other = await make.teacher();
    const updated = await t.api.request('PUT', `/exams/${created.body.payload.id}`, { body: wizard('Hijacked'), token: t.tokenFor(other) });
    expect(updated.status).toBe(403);
  });
});
