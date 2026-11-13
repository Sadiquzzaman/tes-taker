import { randomUUID } from 'crypto';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { StudentExamSubmissionEntity } from '../../src/exams/entities/student-exam-answer.entity';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Options = { levels: { level: string; available: boolean; checks: string[] }[]; auto_disqualify_available: boolean; default_level: string };
type Effective = { level: string; checks: string[]; camera: boolean; auto_disqualify: { threshold: number; warn_at: number; checks: string[] } | null };

/**
 * Proctoring level per exam (P8-01, PRO-01, PRO-02): Off, Light or Strict as the plan allows,
 * checks switched off within the level, auto-disqualification only when the teacher turns it on,
 * and what the student's browser runs, given before the exam starts.
 */
describe('proctoring settings per exam', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;
  let subjectId: string;

  const wizard = (proctoring?: Record<string, unknown>) => {
    const correct = randomUUID();
    return {
      formState: { testName: 'Quiz', duration: '30', passingScore: '', allowNegativeMarking: false, negativeMarking: '', isModelTest: false, ...(proctoring ? { proctoring } : {}) },
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

  /** A solo teacher on the Free plan; `strict` adds camera checks and auto-disqualification by override. */
  const teacherOn = async ({ strict = false } = {}) => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    if (strict) {
      for (const key of ['proctoring_no_face', 'proctoring_multiple_face', 'proctoring_phone', 'proctoring_auto_disqualification']) {
        const res = await t.api.request('PUT', `/subscriptions/admin/organizations/${solo.id}/overrides/${key}`, { body: { value: true, reason: 'P8-01 test' }, token: t.tokenFor(admin) });
        expect(res.status).toBe(200);
      }
    }
    return { teacher, solo, token: t.tokenFor(teacher) };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    subjectId = (await t.dataSource.getRepository(SubjectEntity).save({ name: `Physics ${randomUUID().slice(0, 6)}` })).id;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('offers the levels the plan allows and refuses others; without a choice a new exam gets the best level and no auto-disqualify', async () => {
    const free = await teacherOn();
    const options = (await t.api.get<Body<Options>>('/exams/proctoring-options', free.token)).body.payload;
    expect(options.levels.filter((l) => l.available).map((l) => l.level)).toEqual(['OFF', 'LIGHT']);
    expect([options.default_level, options.auto_disqualify_available]).toEqual(['LIGHT', false]);

    const strict = await t.api.post<Body<unknown>>('/exams', wizard({ level: 'STRICT' }), free.token);
    expect([strict.status, strict.body.code]).toEqual([403, 'EXAM_PROCTORING_LEVEL_NOT_IN_PLAN']);
    const autoOff = await t.api.post<Body<unknown>>('/exams', wizard({ level: 'LIGHT', auto_disqualify: true }), free.token);
    expect([autoOff.status, autoOff.body.code]).toEqual([403, 'EXAM_AUTO_DISQUALIFY_NOT_IN_PLAN']);
    const unknown = await t.api.post<Body<unknown>>('/exams', wizard({ level: 'LIGHT', checks_off: ['proctoring_nonsense'] }), free.token);
    expect([unknown.status, unknown.body.code]).toEqual([400, 'EXAM_PROCTORING_INVALID']);

    const light = await t.api.post<Body<{ id: string }>>('/exams', wizard({ level: 'LIGHT', checks_off: ['proctoring_page_refresh'] }), free.token);
    expect(light.status).toBe(201);
    expect(await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: light.body.payload.id })).toMatchObject({
      proctoring_level: 'LIGHT',
      proctoring_checks_off: ['proctoring_page_refresh'],
      auto_disqualify: false,
    });
    const plain = await t.api.post<Body<{ id: string }>>('/exams', wizard(), free.token);
    expect(await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: plain.body.payload.id })).toMatchObject({ proctoring_level: 'LIGHT', auto_disqualify: false });

    // A student sees what runs before starting: Light needs no camera.
    const student = await make.student();
    const eligibility = await t.api.get<Body<{ proctoring: Effective }>>(`/student/exams/${light.body.payload.id}/eligibility`, t.tokenFor(student));
    expect(eligibility.body.payload.proctoring).toEqual({
      level: 'LIGHT',
      checks: ['proctoring_tab_switch', 'proctoring_fullscreen_exit'],
      camera: false,
      auto_disqualify: null,
    });
  });

  it('runs Strict with the camera and auto-disqualifies at the teacher’s threshold, warning at 60%; an edit without a choice keeps it', async () => {
    const pro = await teacherOn({ strict: true });
    const created = await t.api.post<Body<{ id: string }>>(
      '/exams',
      wizard({ level: 'STRICT', checks_off: ['proctoring_idle'], auto_disqualify: true, disqualify_threshold: 5, disqualify_checks: ['proctoring_phone', 'proctoring_multiple_face'] }),
      pro.token,
    );
    expect(created.status).toBe(201);
    const id = created.body.payload.id;
    const student = await make.student();
    const effective = (await t.api.get<Body<{ proctoring: Effective }>>(`/student/exams/${id}/eligibility`, t.tokenFor(student))).body.payload.proctoring;
    expect(effective).toMatchObject({ level: 'STRICT', camera: true, auto_disqualify: { threshold: 5, warn_at: 3, checks: ['proctoring_multiple_face', 'proctoring_phone'] } });
    expect(effective.checks).toContain('proctoring_no_face');
    expect(effective.checks).not.toContain('proctoring_idle');

    expect((await t.api.request('PUT', `/exams/${id}`, { body: wizard(), token: pro.token })).status).toBe(200);
    expect(await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id })).toMatchObject({ proctoring_level: 'STRICT', auto_disqualify: true, disqualify_threshold: 5 });
    expect((await t.api.request('PUT', `/exams/${id}`, { body: wizard({ level: 'OFF' }), token: pro.token })).status).toBe(200);
    expect((await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id })).proctoring_level).toBe('OFF');
  });

  it('records a "disqualified" submit as a normal one when the exam does not auto-disqualify', async () => {
    const pro = await teacherOn({ strict: true });
    const submitAs = async (autoDisqualify: boolean) => {
      const exam = await make.openExam(pro.teacher, { organization_id: pro.solo.id, auto_disqualify: autoDisqualify });
      const student = await make.student();
      expect((await t.api.post(`/student/exams/${exam.id}/start`, {}, t.tokenFor(student))).status).toBe(201);
      await t.api.post(`/student/exams/${exam.id}/answersheet`, { answersheet: {}, reason: 'disqualified', disqualification_reason: 'Too many flags' }, t.tokenFor(student));
      return (await t.dataSource.getRepository(StudentExamSubmissionEntity).findOneByOrFail({ exam_id: exam.id, student_id: student.id })).status;
    };
    expect(await submitAs(false)).toBe('SUBMITTED');
    expect(await submitAs(true)).toBe('DISQUALIFIED');
  });
});
