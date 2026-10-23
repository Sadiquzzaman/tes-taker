import { StudentExamSubmissionEntity } from '../../src/exams/entities/student-exam-answer.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Eligibility = { payload: { can_access: boolean; reason_code: string } };

/** Exam rules against the real app and database: student cap, deadline on submit, class exam access. */
describe('exams API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let teacher: UserEntity;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    teacher = await make.teacher();
  });

  afterAll(async () => {
    await t.close();
  });

  const start = (examId: string, student: UserEntity) =>
    t.api.post(`/student/exams/${examId}/start`, { user_agent: 'api-test' }, t.tokenFor(student));

  const eligibility = (examId: string, student: UserEntity) =>
    t.api.get<Eligibility>(`/student/exams/${examId}/eligibility`, t.tokenFor(student));

  describe('student cap at start (Free plan: 15 students per exam)', () => {
    it('lets 15 students start, then refuses the 16th with EXAM_FULL; started students can resume', async () => {
      const exam = await make.openExam(teacher);
      const students = await Promise.all(Array.from({ length: 16 }, () => make.student()));

      for (const student of students.slice(0, 15)) {
        await expect(start(exam.id, student)).resolves.toMatchObject({ status: 201 });
      }

      const late = students[15];
      await expect(eligibility(exam.id, late)).resolves.toMatchObject({
        status: 200,
        body: { payload: { can_access: false, reason_code: 'EXAM_FULL' } },
      });
      await expect(start(exam.id, late)).resolves.toMatchObject({ status: 403 });

      // A student who already started is not locked out by the cap.
      await expect(start(exam.id, students[0])).resolves.toMatchObject({ status: 201 });
      const count = await t.dataSource.getRepository(StudentExamSubmissionEntity).countBy({ exam_id: exam.id });
      expect(count).toBe(15);
    });
  });

  describe('final submit and the deadline', () => {
    const submit = (examId: string, student: UserEntity) =>
      t.api.post(`/student/exams/${examId}/answersheet`, { answersheet: {}, reason: 'manual' }, t.tokenFor(student));

    const moveDeadline = (examId: string, student: UserEntity, secondsFromNow: number) =>
      t.dataSource
        .getRepository(StudentExamSubmissionEntity)
        .update({ exam_id: examId, student_id: student.id }, { effective_deadline: new Date(Date.now() + secondsFromNow * 1000) });

    it('accepts a submit before the deadline', async () => {
      const exam = await make.openExam(teacher);
      const student = await make.student();
      await start(exam.id, student);

      await expect(submit(exam.id, student)).resolves.toMatchObject({ status: 201 });
    });

    it('refuses a submit after the deadline and its 60-second grace', async () => {
      const exam = await make.openExam(teacher);
      const student = await make.student();
      await start(exam.id, student);
      await moveDeadline(exam.id, student, -120);

      const response = await submit(exam.id, student);

      expect([400, 403]).toContain(response.status);
      const row = await t.dataSource
        .getRepository(StudentExamSubmissionEntity)
        .findOneByOrFail({ exam_id: exam.id, student_id: student.id });
      expect(row.status).toBe('IN_PROGRESS');
    });

    it('treats a second submit as a no-op that changes nothing', async () => {
      const exam = await make.openExam(teacher);
      const student = await make.student();
      await start(exam.id, student);
      await submit(exam.id, student);
      const repo = t.dataSource.getRepository(StudentExamSubmissionEntity);
      const before = await repo.findOneByOrFail({ exam_id: exam.id, student_id: student.id });

      const second = await submit(exam.id, student);

      // Idempotent by design (e.g. the timer's auto-submit right after a manual submit).
      expect(second).toMatchObject({ status: 201, body: { payload: { already_finalized: true, saved_count: 0 } } });
      const after = await repo.findOneByOrFail({ exam_id: exam.id, student_id: student.id });
      expect(after.status).toBe(before.status);
      expect(after.submitted_at).toEqual(before.submitted_at);
    });
  });

  describe('class exam lists (tenancy)', () => {
    it("gives a teacher their own class exams and another teacher none, with or without answers", async () => {
      const classRow = await make.classOf(teacher);
      await make.openExam(teacher, { class_id: classRow.id });
      const otherTeacher = await make.teacher();

      const own = await t.api.get<{ payload: unknown[] }>(`/exams/class/${classRow.id}`, t.tokenFor(teacher));
      const other = await t.api.get<{ payload: unknown[] }>(`/exams/class/${classRow.id}`, t.tokenFor(otherTeacher));

      expect(own.status).toBe(200);
      expect(own.body.payload).toHaveLength(1);
      expect(other.status).toBe(200);
      expect(other.body.payload).toEqual([]);
    });
  });
});
