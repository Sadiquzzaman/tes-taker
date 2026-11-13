import { DeepPartial } from 'typeorm';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { ExamQuestionEntity, QuestionTypeEnum } from '../../src/exams/entities/exam-question.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamAnswerEntity,
  StudentExamSubmissionEntity,
} from '../../src/exams/entities/student-exam-answer.entity';
import { StudentExamService } from '../../src/exams/student-exam.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Answers saved while writing (P8-05, PRO-09): the browser sends only what changed; the server
 * merges it, clears answers the student cleared, refuses writes after the deadline + grace, and
 * an abandoned attempt is finalised with what was saved.
 */
describe('answers saved while writing', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  /** An open exam with two essay questions and a student who started it. */
  const writing = async (overrides: DeepPartial<ExamEntity> = {}) => {
    const teacher = await make.teacher();
    const exam = await make.openExam(teacher, overrides);
    const questions = t.dataSource.getRepository(ExamQuestionEntity);
    const [q1, q2] = await Promise.all(
      ['Explain gravity.', 'Explain light.'].map((question) =>
        questions.save({ exam: { id: exam.id }, question, question_type: QuestionTypeEnum.SUBJECTIVE, points: 5 } as DeepPartial<ExamQuestionEntity>),
      ),
    );
    const student = await make.student();
    expect((await t.api.post(`/student/exams/${exam.id}/start`, {}, t.tokenFor(student))).status).toBe(201);
    return { exam, q1, q2, student };
  };
  const save = (examId: string, student: UserEntity, answersheet: Record<string, string>) =>
    t.api.request<{ payload: { saved_count: number; saved_at: string } }>('PUT', `/student/exams/${examId}/answersheet`, { body: { answersheet }, token: t.tokenFor(student) });
  const attempt = (examId: string, student: UserEntity) =>
    t.dataSource.getRepository(StudentExamSubmissionEntity).findOneByOrFail({ exam_id: examId, student_id: student.id });
  const answers = async (examId: string, student: UserEntity) => {
    const rows = await t.dataSource.getRepository(StudentExamAnswerEntity).findBy({ submission_id: (await attempt(examId, student)).id });
    return Object.fromEntries(rows.map((row) => [row.question_id, row.text_answer ?? null]));
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
  });

  afterAll(async () => {
    await t.close();
  });

  it('merges what changed into the saved answers, and clears an answer the student cleared', async () => {
    const s = await writing();
    const first = await save(s.exam.id, s.student, { [s.q1.id]: 'Things fall.' });
    expect([first.status, first.body.payload.saved_count]).toEqual([200, 1]);
    expect(Date.parse(first.body.payload.saved_at)).not.toBeNaN();

    // Only the second question changed: the first stays.
    await save(s.exam.id, s.student, { [s.q2.id]: 'It bends.' });
    expect(await answers(s.exam.id, s.student)).toEqual({ [s.q1.id]: 'Things fall.', [s.q2.id]: 'It bends.' });
    expect(JSON.parse((await attempt(s.exam.id, s.student)).answersheet_json!)).toEqual({ [s.q1.id]: 'Things fall.', [s.q2.id]: 'It bends.' });

    // The student cleared the first answer.
    await save(s.exam.id, s.student, { [s.q1.id]: '' });
    expect(await answers(s.exam.id, s.student)).toEqual({ [s.q1.id]: null, [s.q2.id]: 'It bends.' });

    // Not someone else's attempt, and not an unknown question.
    expect((await save(s.exam.id, await make.student(), { [s.q1.id]: 'x' })).status).toBe(400);
    expect((await save(s.exam.id, s.student, { '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d': 'x' })).status).toBe(400);
  });

  it('refuses a save after the deadline and its grace; the attempt is finalised with what was saved', async () => {
    const s = await writing({ duration_minutes: 30 });
    await save(s.exam.id, s.student, { [s.q1.id]: 'Saved before the connection dropped.' });

    // Time passes beyond the deadline + 60 seconds.
    await t.dataSource.getRepository(StudentExamSubmissionEntity).update(
      { exam_id: s.exam.id, student_id: s.student.id },
      { started_at: new Date(Date.now() - 40 * 60_000), effective_deadline: new Date(Date.now() - 10 * 60_000) },
    );
    expect((await save(s.exam.id, s.student, { [s.q1.id]: 'Too late.' })).status).toBe(403);

    await t.app.get(StudentExamService).autoSubmitExpired(new Date());
    expect((await attempt(s.exam.id, s.student)).status).toBe(ExamSubmissionStatusEnum.AUTO_SUBMITTED);
    expect((await answers(s.exam.id, s.student))[s.q1.id]).toBe('Saved before the connection dropped.');
  });

  it('keeps the final submit working with the full sheet after drafts', async () => {
    const s = await writing();
    await save(s.exam.id, s.student, { [s.q1.id]: 'Draft.' });
    const submitted = await t.api.post(
      `/student/exams/${s.exam.id}/answersheet`,
      { answersheet: { [s.q1.id]: 'Final.', [s.q2.id]: '' }, reason: 'manual' },
      t.tokenFor(s.student),
    );
    expect(submitted.status).toBe(201);
    expect(await answers(s.exam.id, s.student)).toEqual({ [s.q1.id]: 'Final.' });
    expect((await attempt(s.exam.id, s.student)).status).toBe(ExamSubmissionStatusEnum.SUBMITTED);
  });
});
